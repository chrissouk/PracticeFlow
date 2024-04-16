const fs = require('fs');
const csv = require('csv-parser');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const path = require('path');

const tokenizer = new natural.WordTokenizer();

/* debugging */
function arrayDims(arr) {
    if (!Array.isArray(arr)) {
        return 0; // If the input is not an array, it has 0 dimensions
    }

    // If the array is empty, it has 1 dimension
    if (arr.length === 0) {
        return 1;
    }

    // Otherwise, find the maximum depth of nested arrays
    let maxDepth = 0;
    for (let i = 0; i < arr.length; i++) {
        const depth = arrayDims(arr[i]);
        if (depth > maxDepth) {
            maxDepth = depth;
        }
    }

    return maxDepth + 1; // Add 1 to account for the current level of nesting
}

// load csv files
async function readCSV(filePath) {
    const data = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                data.push(row);
            })
            .on('end', () => {
                resolve(data);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}


async function createVocab() {
    const practiceData = await readCSV('Data/Training/practiceInfo.csv');
    const setData = await readCSV('Data/Training/setInfo.csv');

    const corpus = practiceData.map(practice => practice.title.toLowerCase())
        .concat(setData.map(set => set.title.toLowerCase()));

    const vocab = new Set();             // add null token for 0 value, make a working joiningString, consolidate functions and clean this up so you can understand it
    
    vocab.add("NULL");

    vocab.add("PRACTICETITLE");
    vocab.add("SETTITLE");    
    vocab.add("EXERCISETITLE");
    vocab.add("STOP");

    corpus.forEach(text => {
        const tokens = tokenizer.tokenize(text);
        tokens.forEach(token => vocab.add(token));
    });

    // Convert the Set to an array and map each token to its index
    const tokenIndexMap = Array.from(vocab).map((key, value) => ({ key, value }));
    // Save the tokenIndexMap to a file
    fs.writeFileSync(path.join('./Models/V3-RealData/', 'vocab.json'), JSON.stringify(tokenIndexMap, null, 2));

    return vocab;
}

// assign each unique token with its integer representation
function encodeText(text, vocab, tokenLabel) {
    console.log(typeof(text));

    const tokens = tokenizer.tokenize(text);

    // Initialize an array to hold the encoded integers for each token, plus initialize the start token
    let tokenizedText = [];
    tokenizedText.push(Array.from(vocab).indexOf(tokenLabel));

    // remap tokens as integer representations
    tokens.forEach(token => {
        const value = Array.from(vocab).indexOf(token);
        if (value !== -1) {
            tokenizedText.push(value);
        }
    });

    // Return the array of encoded integers
    return tokenizedText;
}

// pad titles
async function pad(arr, vocab) {
    // Step 1: Find the length of the longest inner array
    const maxLength = Math.max(...arr.map(item => item.length));

    // Step 2: Pad each inner array with zeros at the beginning to match the length of the longest inner array
    const paddedArray = arr.map(item => {
        // Calculate how many zeros need to be added at the beginning
        const paddingLength = maxLength - item.length;
        // Create an array filled with zeros of the required length
        const padding = new Array(paddingLength).fill(0);
        // Concatenate the padding array with the original title array
        const paddedItem = padding.concat(item);

        return paddedItem;
    });

    return paddedArray;
}

// Function to preprocess hierarchical data
async function preprocessData(vocab) {
    const practiceData = await readCSV('Data/Training/practiceInfo.csv');
    const setData = await readCSV('Data/Training/setInfo.csv');

    // Associate practices with sets and sets with exercises
    const practiceSets = practiceData.map(practice => ({
        ...practice,
        sets: setData.filter(set => set.practiceID === practice.practiceID)
    }));

    const titles = practiceSets.map(practice => ({
        practiceTitle: practice.title.toLowerCase(),
        setTitles: practice.sets.map(set => set.title.toLowerCase())
    }));

    const encodedPracticeTitles = titles.map(seq => encodeText(seq.practiceTitle, vocab, "PRACTICETITLE"));
    const encodedSetTitles = titles.map(seq => encodeText(seq.setTitles.join('|'), vocab, "SETTITLE"));

    // Combine encoded practice titles with their corresponding encoded set titles
    const combinedTitles = encodedPracticeTitles.map((practiceTitle, index) => {
        return practiceTitle.concat(encodedSetTitles[index]);
    });

    let nGrams = [];
    for (let i = 0; i < combinedTitles.length; i++) {
        for (let j = 1; j < combinedTitles[i].length; j++) {
            nGrams.push(combinedTitles[i].slice(0, j + 1))
        }
    }

    const features = await pad(nGrams.map(nGram => nGram.slice(0,-1)), vocab);
    const labels = nGrams.map(nGram => nGram.slice(-1)).flat();
    const labelProbabilityDistributions = labels.map(labelValue => {
        let probabilityDistribution = new Array(vocab.size).fill(0);
        probabilityDistribution[labelValue] = 1;
        return probabilityDistribution
    });

    const maxFeatureLength = Math.max(...features.map(feature => feature.length));
    const maxLabelLength = vocab.size;

    return { features, maxFeatureLength, labelProbabilityDistributions, maxLabelLength }

}

async function createSetModel() {
    // declare features and labels
    let X, Y, maxXLength, maxYLength;

    // get vocabSize and uniqueTokens
    const vocab = await createVocab();

    // Preprocess hierarchical data
    await preprocessData(vocab).then(data => {
            X = data.features;
            maxXLength = data.maxFeatureLength;
            Y = data.labelProbabilityDistributions;
            maxYLength = data.maxLabelLength;
        });

    // save maxXLength
    fs.writeFileSync(path.join(__dirname, 'Models/V3-RealData/maxXLength.json'), JSON.stringify({ maxXLength }));

    console.log(`${arrayDims(X)} ${arrayDims(Y)}`);

    // Define the model architecture
    const model = tf.sequential();

    // Define hyperparameters
    const embeddingDim = 128;
    const lstmUnits = 128;

    // create layers
    model.add(tf.layers.embedding({inputDim: vocab.size, 
                                   outputDim: embeddingDim, 
                                   inputLength: maxXLength}));
    model.add(tf.layers.lstm({units: lstmUnits}));
    model.add(tf.layers.dense({units: vocab.size, activation: 'softmax'}));

    // Compile
    model.compile({optimizer: 'adam', loss: 'categoricalCrossentropy'});
    model.summary();

    // Convert X and Y to tensors
    const XTensor = tf.tensor2d(X);
    const YTensor = tf.tensor2d(Y);

    // early stoping
    const earlyStoppingCallback = tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        patience: 5, // Stop training if there's no improvement in validation loss for 5 epochs
        minDelta: 0.001, // Consider an improvement if the validation loss decreases by at least 0.001
       });

    // Train the model
    try {
        await model.fit(XTensor, YTensor, {
            epochs: 500,
            batchSize: 4,
            validationSplit: 0.2,
            callbacks: [earlyStoppingCallback]
        });
    } catch (error) {
        console.error('There was a problem training the model:', error);
    }

    // Save the model
    try {
        await model.save('file://./Models/V3-RealData');
    } catch (error) {
        console.error('There was a problem saving the model:', error);
    }
    
}

// Call the asynchronous function to start the execution
createSetModel().catch(console.error);
