const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const fastCsv = require('fast-csv');

const directoryPath = path.join(__dirname, 'Data/Raw/Teamunify');
let linedDataArray = [];
let setGroupedDataArray = [];
let currentGroup = [];
let filteredDataArray = [];
let practiceGroupedDataArray = [];

async function dataParser(){
    for (const file of fs.readdirSync(directoryPath)) {
        if(path.extname(file) === '.pdf') {
            let dataBuffer = fs.readFileSync(path.join(directoryPath, file));
            try {
                let data = await pdfParse(dataBuffer);
                let lines = data.text.split('\n'); // Split the text into lines
                linedDataArray.push(...lines); // Push the lines into the array)
            } catch (error) {
                // console.error(`Error parsing PDF file ${file}: ${error}`);
            }
        }
    }

    // tabularize data

    // digest data

    // group into sets
    linedDataArray.forEach((line, index) => {
        if (typeof line === 'string' && typeof linedDataArray[index - 1] === 'string') {
            if (line == '' || (line.endsWith(' x') && !linedDataArray[index - 1].includes(':'))) {
                if (currentGroup.length > 0) {
                    setGroupedDataArray.push(currentGroup);
                    currentGroup = [];
                }
            }
        }
        currentGroup.push(linedDataArray[index - 1]);
    });
    if (currentGroup.length > 0) {
        setGroupedDataArray.push(currentGroup);
    }

    // filter necessary info
    filteredDataArray = setGroupedDataArray
        .filter(item => typeof item[0] === 'string' && !item[0].includes("This website is powered")) // remove TU labels
        .map(subArray => subArray.filter(item => !item.includes("DistanceDurationSet"))) // remove column headers
        .map(subArray => subArray.filter(item => item !== undefined)); // remove holes


    // group into practices
    currentGroup = [];
    filteredDataArray.forEach((line) => {
        if (typeof line[0] === 'string' && typeof line[1] === 'string') {
            if (line[0] == '' && line[1] == '') {
                if (currentGroup.length > 0) {
                    practiceGroupedDataArray.push(currentGroup);
                    currentGroup = [];
                }
            }
        }
        currentGroup.push(line);
    });
    if (currentGroup.length > 0) {
        practiceGroupedDataArray.push(currentGroup);
    }

// split into descriptions and details

    let descriptions = [];
    let details = [];

    // create descriptions
    practiceGroupedDataArray.forEach((description) => {
        descriptions.push(description[0]);
    });
    // filter descriptions
    descriptions = descriptions.map(description => description.filter(item => item !== ''));
    // add ids
    for(let i = 0; i < descriptions.length; i++) {
        descriptions[i].unshift(i);
    }
    // reorgainze descriptions
    descriptions.forEach((description) => {
        let headers = description[2];

        let distance = headers.split('Duration:')[0].split('Distance:')[1].split(' ')[0].trim();
        distance = cleanNumber(distance);
        let duration = headers.split('Stress:')[0].split('Duration:')[1].trim();
        duration = convertToSeconds(duration);
        let stress = headers.split('Course:')[0].split('Stress:')[1].trim();
        let course = headers.split('Type:')[0].split('Course:')[1].trim();
        let type = headers.split('Created Date:')[0].split('Type:')[1].trim();
        let createdDate = headers.split('Author:')[0].split('Created Date:')[1].trim();
        let author = headers.split('Author:')[1].trim();

        description.pop(); // removes "headers" line

        description.push(distance, duration, stress, course, type, createdDate, author);
    });

    // create details w/ practice and set ids
    practiceGroupedDataArray.forEach((practice, practiceId) => {

        for(let i = 1; i < practice.length; i++) {
            let set = practice[i];
            let tempArray = [];

            tempArray.push(practiceId);     // practice id
            tempArray.push(i - 1);          // set id
            set.forEach((line) => {
                if (typeof line === 'string') {
                    tempArray.push(line);
                }
            })
            details.push(tempArray);
        }

    });
    // filter details
    details.forEach((set, index) => {
        let startIndex;
        let endIndex;

        // delete "NOTES:"
        try {
            startIndex = set.findIndex(line => typeof line === 'string' && line.includes("NOTES:") ); // Find the index of the item
        } catch (error) { console.error(error); }
        if (startIndex !== -1) {
            set.splice(startIndex); // Remove the item and all following items
        }

        // delete "NOTE:"
        try {
            startIndex = set.findIndex(item => typeof item === 'string' && item.startsWith("NOTE:"));
            endIndex = set.findIndex((item, i) => (typeof item === 'string' && i > startIndex && (item.startsWith("REST:") || /^\d+ x /.test(item))));
        } catch (error) { console.error(error); }
        if (startIndex !== -1 && endIndex !== -1) {
            set.splice(startIndex + 1, endIndex - startIndex - 1);
        }

    // reorgainze details

        let newSet = [];

        let practiceID = set[0];
        let setID = set[1];
        let setTitle;
        let setDistance;
        let setDuration;
        let rounds;
        let exerciseID;
        let reps;
        let distance;
        let interval;
        let energy;
        let type;
        let stroke;
        let pace;
        let notes;


        // parse set description
        let setHeaders = set.find(item => typeof item === 'string' && item.endsWith(' x'));

        // set title
        if (setHeaders == set[2]) {
            setTitle = "Untitled";
        } else {
            setTitle = set[2];
        }

        let lastCommaIndex = setHeaders.lastIndexOf(",");
        let dissection;

        if (lastCommaIndex !== -1) {
            // If there is a comma, split after three numbers following the last comma
            dissection = (setHeaders.slice(0, lastCommaIndex + 4) + " " + setHeaders.slice(lastCommaIndex + 4).trim()).split(" ");
        } else {
            // If there is no comma, split after the first three numbers
            dissection = setHeaders.split(/(?<=^\d{3})/).map(str => str.trim());
        }
        setDistance = cleanNumber(dissection[0]);

        let lastColonIndex = dissection[1].lastIndexOf(":");
        setDuration = dissection[1].slice(0, lastColonIndex + 3);
        rounds = dissection[1].slice(lastColonIndex + 3).split(' ')[0];

    // remake details

        let exerciseIndex = set.findIndex(item => item === setHeaders) + 1;

        for (let i = exerciseIndex; i < set.length; i++) {
            let exercise = set[i];

            exerciseID = i;

            if (exercise.startsWith('Rest:')) {

                reps = 1;
                distance = 0;
                interval = convertToSeconds(exercise.split(': ')[1].trim());
                energy = "RES";
                type = "";
                stroke = "";
                pace = "";
                notes = "Rest"

                newSet.push([practiceID, setID, setTitle, setDistance, setDuration, rounds, exerciseID, reps, distance, interval, energy, type, stroke, pace, notes]);

            } else if ((/^\d+ x /).test(exercise)) {

                try {
                    reps = exercise.split(' x ')[0].trim();
                } catch (error) {
                    console.error(`\nError: Can't parse reps.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n\n${error}`);
                }
                try {
                    distance = cleanNumber(exercise.split(' x ')[1].split(' @ ')[0].trim());
                } catch (error) {
                    console.error(`\nError: Can't parse distance.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n\n${error}`);
                }
                try {
                    interval = convertToSeconds(exercise.split(' @ ')[1].split(' ')[0].trim());
                } catch (error) {
                    console.error(`\nError: Can't parse interval.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n\n${error}`);
                }

                let statsIndex = -1; // default value
                let stats;
                try {
                    if (exercise.indexOf("EN") !== -1) { statsIndex = exercise.indexOf("EN"); }
                    else if (exercise.indexOf("RE") !== -1) { statsIndex = exercise.indexOf("RE"); }
                    else if (exercise.indexOf("SP") !== -1) { statsIndex = exercise.indexOf("SP"); }
                    stats = exercise.slice(statsIndex, exercise.length);
                } catch (error) {
                    console.error(`\nError: Can't parse stats.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n`);
                }

                energy = stats.slice(0, 3).trim();

                if (stats.includes("WU")) { type = "WU"; }
                else { type = stats.slice(3, 4).trim(); }
                
                if (stats.includes("WU") && stats.slice(5, stats.length - 5).length == 3) {
                    stroke = stats.slice(5, 8).trim();
                } else if (stats.includes("WU") && stats.slice(5, stats.length - 5).length == 2) {
                    stroke = stats.slice(5, 7).trim();
                } else if (stats.slice(4, stats.length - 5).length == 3) {
                    stroke = stats.slice(4, 7).trim();
                } else if (stats.slice(4, stats.length - 5).length == 2) {
                    stroke = stats.slice(4, 6).trim();
                } else {
                    console.error(`\nError: Can't parse stroke stat.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n`);
                }
                
                try {
                    pace = stats.slice(-5).trim();
                } catch (error) {
                    console.error(`\nError: Can't parse pace stat.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n\n${error}`);
                }
                
                try {
                    let notesIndex = exercise.indexOf(":") + 3;
                    notes = exercise.slice(notesIndex, statsIndex).trim();
                } catch (error) {
                    console.error(`\nError: Can't parse notes.\nPracticeID: ${practiceID}\nSetID: ${setID}\nexerciseID: ${exerciseID}\n\n${error}`);
                }

                newSet.push([practiceID, setID, setTitle, setDistance, setDuration, rounds, exerciseID, reps, distance, interval, energy, type, stroke, pace, notes]);
            
            } else {
                newSet[newSet.length - 1][14] += " " + exercise;
            }
        }

        details[index] = newSet;
    });

    // flatten details
    details = details.reduce((accumulator, currentValue) => accumulator.concat(currentValue), []);

    // Convert each sub-array in descriptions to an object
    descriptions = descriptions.map(description => {
        return {
            practiceID: description[0],
            title: description[1],
            distance: description[2],
            duration: description[3],
            stress: description[4],
            course: description[5],
            type: description[6],
            creationDate: description[7],
            author: description[8]
        };
    });
    
    // Convert each sub-array in details to an object
    details = details.map(detail => {
        return {
            practiceID: detail[0],
            setID: detail[1],
            setTitle: detail[2],
            setDistance: detail[3],
            setDuration: detail[4],
            rounds: detail[5],
            exerciseID: detail[6],
            reps: detail[7],
            distance: detail[8],
            interval: detail[9],
            energy: detail[10],
            type: detail[11],
            stroke: detail[12],
            pace: detail[13],
            notes: detail[14]
        };
    });

    // Write details and descriptions to CSV
    await fastCsv.writeToPath('Data/Training/descriptions.csv', descriptions, { headers: true, delimiter: '|' });
    await fastCsv.writeToPath('Data/Training/details.csv', details, { headers: true, delimiter: '|' });
}

function convertToSeconds(time) {
    let hours, minutes, seconds;
    switch ((time.match(/:/g) || []).length) {
        case 0:
            return +time;
        case 1:
            minutes = +time.split(":")[0];
            seconds = +time.split(":")[1];
            return (minutes * 60) + seconds;
        case 2:
            hours = +time.split(":")[0]
            minutes = +time.split(":")[1];
            seconds = +time.split(":")[2];
            return (hours * (60 * 60)) + (minutes * 60) + seconds;
    }
}
function cleanNumber(number) {
    return +number.replace(/,/g, "");
}

dataParser();