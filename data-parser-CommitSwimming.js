const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const fastCsv = require('fast-csv');
const { raw } = require('express');
const { timeStamp } = require('console');

const directoryPath = path.join(__dirname, 'Data/Raw/CommitSwimming');
let rawDataArray = [];


async function dataParser(){
    // scan pdfs
    for (const file of fs.readdirSync(directoryPath)) {
        if(path.extname(file) === '.pdf') {
            let dataBuffer = fs.readFileSync(path.join(directoryPath, file));
            try {
                let data = await pdfParse(dataBuffer);
                let lines = data.text.split('\n'); // Split the text into lines
                let groupedLines = [];
                let currentGroup = [];
                lines.forEach(line => {
                    if (line.trim() === '') { // If the line is empty
                        if (currentGroup.length > 0) { // If the current group is not empty
                            groupedLines.push(currentGroup); // Push the current group to groupedLines
                            currentGroup = []; // Start a new group
                        }
                    } else {
                        currentGroup.push(line); // If the line is not empty, add it to the current group
                    }
                });
                if (currentGroup.length > 0) { // If the last group is not empty
                    groupedLines.push(currentGroup); // Push the last group to groupedLines
                }
                rawDataArray.push(groupedLines); // Push the groupedLines into the rawDataArray
            } catch (error) {
                // console.error(`Error parsing PDF file ${file}: ${error}`);
            }
        }
    }
    rawDataArray = rawDataArray.flat();

    // filter raw data
    rawDataArray = rawDataArray.map((practice) => {
        let tempArray;

        tempArray = practice.filter(line => !line.endsWith("sets"));
        tempArray = tempArray.filter(line => !line.includes("yds"));

        return tempArray;
    });

    // console.log(rawDataArray);

// CREATE PRACTICE INFO
    let practiceInfo = [];
    let tempArray = [];
    practiceInfo = rawDataArray.map(practice => {
        const separatorIndex = practice.findIndex(line => /^-+$/.test(line));
        if (separatorIndex >= 0) {
            return practice.slice(0, separatorIndex);
        } else {
            return practice;
        }
    });

    practiceInfo.forEach((info, index) => {
        console.log(info[0]);
        console.log(info[0].split('|')[0]);
        let title = info[0].split('|')[0].trim();
        info = [index, title];
    });

// CREATE SET INFO
    let setInfo = [];
    tempArray = [];
    setInfo = rawDataArray.map(set => {
        const separatorIndex = set.findIndex(line => /^-+$/.test(line));
        if (separatorIndex >= 0) {
            return set.slice(separatorIndex + 1);
        } else {
            return set;
        }
    });

    // console.log(practiceInfo);

    // when i wanna append to files
    // const csvStream = fastCsv.format({ headers: true });
    // const writeStream = fs.createWriteStream('practiceInfo.csv', { flags: 'a' });

    // csvStream.pipe(writeStream).on('end', () => process.exit());

    // csvStream.write({ /* your data here */ });
    // csvStream.end();
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