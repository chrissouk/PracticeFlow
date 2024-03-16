const fs = require('fs');
const csv = require('csv-parser');
const tf = require('@tensorflow/tfjs-node');

// Function to read and parse a CSV file
async function readCSV(filePath) {
    const data = [];
    let isFirstLine = true;
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                if (isFirstLine) {
                    isFirstLine = false;
                } else {
                    data.push(row);
                }
            })
            .on('end', () => {
                resolve(data);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

function stringToNumber(strings) {
    const lookupTable = {};
    let nextId = 0;
    return strings.map(str => {
        if (!lookupTable[str]) {
            lookupTable[str] = nextId++;
        }
        return lookupTable[str];
    });
}

// Function to preprocess hierarchical data
async function preprocessHierarchicalData() {
    const practices = await readCSV('Data/Training/practiceInfo.csv');
    const sets = await readCSV('Data/Training/setInfo.csv');
    const exercises = await readCSV('Data/Training/exerciseInfo.csv');

    // Associate practices with sets and sets with exercises
    const practiceSets = practices.map(practice => ({
        ...practice,
        sets: sets.filter(set => set.practiceID === practice.practiceID)
    }));

    practiceSets.forEach(practice => {
        practice.sets.forEach(set => {
            set.exercises = exercises.filter(exercise => exercise.setID === set.setID);
        });
    });

    // Flatten the hierarchy into a sequence of exercises for each practice
    const practiceExerciseSequences = practiceSets.map(practice => ({
        practiceID: practice.practiceID,
        exerciseSequence: practice.sets.flatMap(set => set.exercises.map(exercise => exercise.exerciseID))
    }));

    return practiceExerciseSequences;
}

async function preprocessDataAndTrainModel() {
    // Preprocess hierarchical data
    const practiceExerciseSequences = await preprocessHierarchicalData();

    // Generate training data from preprocessed hierarchical data
    let X = practiceExerciseSequences.map(seq => seq.exerciseSequence);
    let Y = practiceExerciseSequences.map(seq => seq.practiceID);

    // Convert Y to an array of numbers
    let YNumeric = stringToNumber(Y);

    // Convert X to an array of number arrays
    let XNumeric = X.map(seq => stringToNumber(seq));

    // Determine the number of unique classes
    const numClasses = Math.max(...YNumeric) + 1;

    // Convert Y to a tensor and then one-hot encode it
    const YTensor = tf.tensor1d(YNumeric, 'int32');
    const YOneHotTensor = tf.oneHot(YTensor, numClasses);

    // Find the maximum length of the sequences in XNumeric
    const maxLength = Math.max(...XNumeric.map(seq => seq.length));

    // Pad the sequences to ensure they all have the same length
    const paddedX = XNumeric.map(seq => {
        const padding = Array(maxLength - seq.length).fill(0); // Assuming 0 is the padding value
        return [...seq, ...padding];
    });

    const paddedX3D = paddedX.map(seq => seq.map(num => [num]));

    // Convert the padded sequences into a tensor
    const XTensor = tf.tensor3d(paddedX3D, [paddedX.length, maxLength, 1]);

    // Create model
    const model = tf.sequential();
    model.add(tf.layers.lstm({units: 128, inputShape: [maxLength, 1]}));
    model.add(tf.layers.dense({units: numClasses, activation: 'softmax'}));

    // Compile model
    model.compile({loss: 'categoricalCrossentropy', optimizer: 'adam'});

    // Train model
    try {
        await model.fit(XTensor, YOneHotTensor, { epochs: 2, batchSize: 32 });
    } catch (error) {
        console.error('There was a problem training the model:', error);
    }

    // Save model
    try {
        await model.save('file://./Models/V3-RealData');
    } catch (error) {
        console.error('There was a problem saving the model:', error);
    }
}

// Call the asynchronous function to start the execution
preprocessDataAndTrainModel().catch(console.error);
