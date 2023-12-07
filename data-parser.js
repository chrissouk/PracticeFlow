const fs = require('fs');
const path = require('path');
let pdfjsLib;
import('pdfjs-dist').then(pdfjs => {
    pdfjsLib = pdfjs;
    dataParser();
});

const directoryPath = path.join(__dirname, 'Data/Tim\'s Workouts');
let linedDataArray = []; // Initialize an empty array
let setGroupedDataArray = [];
let currentGroup = [];
let filteredDataArray = [];
let practiceGroupedDataArray = [];


function dataParser(){

    async function extractTextFromPDF(pdfPath) {
        const pdf = await pdfjsLib.getDocument(pdfPath).promise;
        let text = '';
        for(let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const tokenizedText = await page.getTextContent();
            const strings = tokenizedText.items.map(token => token.str);
            text += strings.join(' ');
        }
        return text;
    }

    const files = fs.readdirSync(directoryPath);

    files.forEach(file => {
        if(path.extname(file) === '.pdf') {
            const pdfPath = path.join(directoryPath, file);
            extractTextFromPDF(pdfPath)
                .then(text => {
                    let lines = text.split('\n'); // Split the text into lines
                    console.log(lines);
                    linedDataArray.push(...lines); // Push the lines into the array
                })
                .catch(err => console.error(err));
        }
    });

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
    filteredDataArray.forEach((line, index) => {
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

// split into description and details

    let description = [];
    let details = [];

    // create description
    practiceGroupedDataArray.forEach((subArray, index) => {
        description.push(subArray[0]);
    });
    // filter description
    description = description.map(subArray => subArray.filter(item => item !== ""));
    // add ids
    for(let i = 0; i < description.length; i++) {
        description[i].unshift(i);
    }

    // console.log(description);
}