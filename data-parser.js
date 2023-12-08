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
    // scan pdfs
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

    // group into sets
    linedDataArray.forEach((line, index) => {
        if (typeof line === 'string' && typeof linedDataArray[index - 1] === 'string') {
            if (line == '' || line.endsWith(' x')) {
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

// split into practiceInfo, setInfo, and exerciseInfo

    let practiceInfo = [];
    let setInfo = [];
    let exerciseInfo = [];

// CREATE PRACTICE INFO
    practiceGroupedDataArray.forEach((practice) => {
        practiceInfo.push(practice[0]);
    });
    // filter practiceInfo
    practiceInfo = practiceInfo.map(info => info.filter(item => item !== ''));
    // add ids
    for(let i = 0; i < practiceInfo.length; i++) {
        practiceInfo[i].unshift(i);
    }
    // reorgainze practiceInfo
    practiceInfo.forEach((info) => {
        let headers = info[2];

        let titleParts = info[1].split(' ');
        titleParts.splice(0, 1); // Remove the date
        info[1] = titleParts.join(' ').trim();
        if (/^(am|pm)/i.test(info[1])) {
            titleParts = info[1].split(' ');
            info[1] = titleParts.splice(1,titleParts.length).join(' ');
        }
        if (info[1] == '') {
            info[1] = 'Untitled';
        }

        let distance = headers.split('Duration:')[0].split('Distance:')[1].split(' ')[0].trim();
        distance = cleanNumber(distance);
        let duration = headers.split('Stress:')[0].split('Duration:')[1].trim();
        duration = convertToSeconds(duration);
        let stress = headers.split('Course:')[0].split('Stress:')[1].trim();
        let course = headers.split('Type:')[0].split('Course:')[1].trim();
        let type = headers.split('Created Date:')[0].split('Type:')[1].trim();
        let createdDate = headers.split('Author:')[0].split('Created Date:')[1].trim();
        let author = headers.split('Author:')[1].trim();

        info.pop(); // removes "headers" line

        info.push(distance, duration, stress, course, type, createdDate, author);
    });

// CREATE SET INFO & EXERCISE INFO
    practiceGroupedDataArray.forEach((practice, practiceId) => {
        for(let i = 1; i < practice.length; i++) {
            let set = practice[i];
            let tempArray = [];

            tempArray.push(practiceId);     // practice id
            tempArray.push(i - 1);          // set id
            set.forEach((line) => {         // add every line in the set
                if (typeof line === 'string') {
                    tempArray.push(line);
                }
            })
            setInfo.push(tempArray);
            exerciseInfo.push(tempArray);
        }
    });
    setInfo.forEach((set, index) => {

        let practiceID = set[0];
        let setID = set[1];
        let title;
        let distance;
        let duration;
        let rounds;

        // parse set info
        let setHeaders = set.find(item => typeof item === 'string' && item.endsWith(' x'));

        // set title
        if (setHeaders == set[2] || /^\d+ x /.test(set[2])) {
            title = "Untitled";
        } else {
            title = set[2];
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
        distance = cleanNumber(dissection[0]);

        let lastColonIndex = dissection[1].lastIndexOf(":");
        duration = dissection[1].slice(0, lastColonIndex + 3);
        rounds = dissection[1].slice(lastColonIndex + 3).split(' ')[0];

        setInfo[index] = [practiceID, setID, title, distance, duration, rounds];

    });
    exerciseInfo.forEach((set, index) => {
        let newSet = [];

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

        let practiceID = set[0];
        let setID = set[1];
        let exerciseID = -1;
        let reps;
        let distance;
        let interval;
        let energy;
        let type;
        let stroke;
        let pace;
        let notes;        

        // find exercises
        let setHeaders = set.find(item => typeof item === 'string' && item.endsWith(' x'));
        let exerciseIndex = set.findIndex(item => item === setHeaders) + 1;

        for (let i = exerciseIndex; i < set.length; i++) {
            let exercise = set[i];

            if ((/^\d+ x /).test(exercise)) {

                exerciseID++;

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

                newSet.push([practiceID, setID, exerciseID, reps, distance, interval, energy, type, stroke, pace, notes]);

            } else {
                newSet[newSet.length - 1][10] += " " + exercise;
            }
        }
        exerciseInfo[index] = newSet;

    });

    // flatten exerciseInfo
    exerciseInfo = exerciseInfo.reduce((accumulator, currentValue) => accumulator.concat(currentValue), []);

    // Convert to objects
    practiceInfo = practiceInfo.map(info => {
        return {
            practiceID: info[0],
            title: info[1],
            distance: info[2],
            duration: info[3],
            stress: info[4],
            course: info[5],
            type: info[6],
            creationDate: info[7],
            author: info[8]
        };
    });
    setInfo = setInfo.map(info => {
        return {
            practiceID: info[0],
            setID: info[1],
            title: info[2],
            distance: info[3],
            duration: info[4],
            rounds: info[5]
        };
    });
    exerciseInfo = exerciseInfo.map(info => {
        return {
            practiceID: info[0],
            setID: info[1],
            exerciseID: info[2],
            reps: info[3],
            distance: info[4],
            interval: info[5],
            energy: info[6],
            type: info[7],
            stroke: info[8],
            pace: info[9],
            notes: info[10]
        };
    });

    // Write setInfo and practiceInfo to CSV
    await fastCsv.writeToPath('Data/Training/practiceInfo.csv', practiceInfo, { headers: true, delimiter: '|' });
    await fastCsv.writeToPath('Data/Training/setInfo.csv', setInfo, { headers: true, delimiter: '|' });
    await fastCsv.writeToPath('Data/Training/exerciseInfo.csv', exerciseInfo, { headers: true, delimiter: '|' });
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