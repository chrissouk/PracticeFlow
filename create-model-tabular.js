const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const fs = require('fs');

async function createModelTabular() {
    // initialize new tokenizer
    const tokenizer = new natural.WordTokenizer();

    // initialize variables
    const inputLength = 2;
    const numEpochs = 10;
    const batchSize = 32;

    // Read the practice plan text from a file
    const source = 'test-data.txt';
    
    let practicePlanText = '';
    try {
        practicePlanText = await fs.promises.readFile(source, 'utf8');
    } catch (error) {
        console.log('There was a problem reading the test data:', error);
    }

    const tokenized = tokenizer.tokenize(practicePlanText);

    // Build vocabulary and update 'numWords'
    const wordIndex = {};
    const indexToWord = {};
    let wordCounter = 0;

    tokenized.forEach((word) => {
        if (!wordIndex[word]) {
            wordCounter++;
            wordIndex[word] = wordCounter;
            indexToWord[wordCounter] = word;
        }
    });

    let numWords = Object.keys(wordIndex).length + 1; // +1 for the padding token

    // read test-data.txt and split by line
    const data = fs.readFileSync(source, 'utf8');
    const practicePlans = data.split('\n');

    // tabularize
    let table = [];

    for (let i = 0; i < practicePlans.length; i++) {
        const practicePlan = practicePlans[i];
        const parts = practicePlan ? practicePlan.split('. ') : [];

        for (let part of parts) {
            let [setTitle, details] = part ? part.split(': ') : [];
            let [repetitions, distance, stroke, intensity] = details ? details.split(' ') : [];

            table.push({
                setTitle,
                repetitions,
                distance,
                stroke,
                intensity
            });
        }
    }

    // Assuming 'table' is your data in tabular format

    // Extract features and labels
    let features = table.map(row => [row.setTitle, row.repetitions, row.distance, row.stroke]);
    let labels = table.map(row => row.intensity);

    // Encode categorical data
    features = tf.oneHot(tf.tensor1d(features, 'int32'), numClasses);
    labels = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses);

    // Normalize numerical data
    let featuresTensor = tf.tensor2d(features, [features.length, features[0].length], 'float32');
    let min = featuresTensor.min();
    let max = featuresTensor.max();
    features = featuresTensor.sub(min).div(max.sub(min));

    // Assuming 'data' is your preprocessed, normalized and encoded data
    // and 'labels' are your one-hot encoded labels

    // Split the data into training and test sets
    const splitIdx = Math.floor(data.length * 0.8);
    const xsTrain = data.slice(0, splitIdx);
    const xsTest = data.slice(splitIdx);
    const ysTrain = labels.slice(0, splitIdx);
    const ysTest = labels.slice(splitIdx);

    // Create the model
    const model = tf.sequential();
    model.add(tf.layers.dense({units: 32, activation: 'relu', inputShape: [data[0].length]}));
    model.add(tf.layers.dense({units: 16, activation: 'relu'}));
    model.add(tf.layers.dense({units: labels[0].length, activation: 'softmax'}));

    // Compile the model
    model.compile({optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy']});

    // Train the model
    await model.fit(xsTrain, ysTrain, {epochs: 10, batchSize: 32});

    // Evaluate the model
    const {loss, acc} = model.evaluate(xsTest, ysTest, {batchSize: 32});
    console.log(`Test loss: ${loss}, Test accuracy: ${acc}`);

    // save model
    await model.save('file://./Models/V2-Tabular');
}

// Call the asynchronous function to start the execution
createModelTabular().catch(console.error);