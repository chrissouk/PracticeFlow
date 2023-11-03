const fs = require('fs');


const source = 'test-data-10-sessions.txt';

// read data and split by line
const data = fs.readFileSync(source, 'utf8');
const practicePlanArray = data.split('\n');

let cleanPlanArray = [];

let partsArray = []; // intermediate step

let setArray = [];

let labelArray = []; // set titles
let exerciseArray = []; // exercises

let distanceArray = [];
let strokeArray = []; // strokes
let intensityArray = []; // intensities


practicePlanArray.forEach((plan) => {
    setArray.push(plan.split("."));
});
console.log(setArray);
for (let i; i < setArray.length; i++) {
    setArray[i] = setArray[i].trim();
    if (setArray[i] == "") { return; }

    partsArray = setArray[i].split(":");
    partsArray = partsArray.filter(item => item !== "");

    labelArray.push(partsArray[0]);

    exerciseArray.push(partsArray[1]);
    exerciseArray.forEach((exercise) => {
        exercise = exercise.trim();

        partsArray = [];
        partsArray = exercise.split(" ");
        partsArray = partsArray.filter(item => item !== "");
        
        distanceArray.push(partsArray[0]);
        strokeArray.push(partsArray[1]);
        intensityArray.push(partsArray[2]);
    });
    cleanPlanArray.push([labelArray[i], distanceArray[i], strokeArray[i], intensityArray[i]]);
    console.log(cleanPlanArray);
}