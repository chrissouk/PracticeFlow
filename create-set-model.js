const fs = require('fs');
const csv = require('csv-parser');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');

const tokenizer = new natural.WordTokenizer();

/* debugging */
function getArrayDimensions(arr) {
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
        const depth = getArrayDimensions(arr[i]);
        if (depth > maxDepth) {
            maxDepth = depth;
        }
    }

    return maxDepth + 1; // Add 1 to account for the current level of nesting
}

// Function to read and parse a CSV file
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

async function calculateVocabSizeAndTokenize() {
    const practices = await readCSV('Data/Training/practiceInfo.csv');
    const sets = await readCSV('Data/Training/setInfo.csv');

    const allTextData = practices.map(practice => practice.title)
        .concat(sets.map(set => set.title));

    const uniqueTokens = new Set();
    allTextData.forEach(text => {
        const tokens = tokenizer.tokenize(text);
        tokens.forEach(token => uniqueTokens.add(token));
    });

    const vocabSize = uniqueTokens.size;
    return { vocabSize, uniqueTokens };
}

// assign each unique token with an integer
function encodeText(text, uniqueTokens) {
    // Tokenize the text string
    const tokens = tokenizer.tokenize(text);

    // Initialize an array to hold the encoded integers for each token
    let encodedTokens = [];

    // Iterate over each token
    tokens.forEach(token => {
        // Find the index of the token in the uniqueTokens set
        const index = Array.from(uniqueTokens).indexOf(token);
        if (index !== -1) {
            // Add the index (encoded integer) to the array
            encodedTokens.push(index + 1);
        }
    });

    // Return the array of encoded integers
    return encodedTokens;
}

// pad titles
async function padTitles(titles) {
    // Step 1: Find the length of the longest inner array
    const maxLength = Math.max(...titles.map(title => title.length));

    // Step 2: Pad each inner array with zeros to match the length of the longest inner array
    const paddedTitles = titles.map(title => {
        // Create a new array with the same elements as the inner array
        const paddedTitle = [...title];
        // Calculate how many zeros need to be added
        const paddingLength = maxLength - title.length;
        // Add the required number of zeros to the end of the array
        for (let i = 0; i < paddingLength; i++) {
            paddedTitle.push(0);
        }
        return paddedTitle;
    });
    
    return {paddedTitles, maxLength};
}

// Function to preprocess hierarchical data
async function preprocessData(vocabSize, uniqueTokens) {
    const practices = await readCSV('Data/Training/practiceInfo.csv');
    const sets = await readCSV('Data/Training/setInfo.csv');

    // Associate practices with sets and sets with exercises
    const practiceSets = practices.map(practice => ({
        ...practice,
        sets: sets.filter(set => set.practiceID === practice.practiceID)
    }));

    // Flatten the hierarchy into a sequence of exercises for each practice
    const practiceExerciseSequences = practiceSets.map(practice => ({
        practiceTitle: practice.title,
        setTitles: practice.sets.map(set => set.title)
    }));

    const encodedPracticeTitles = practiceExerciseSequences.map(seq => encodeText(seq.practiceTitle, uniqueTokens, vocabSize));
    const encodedSetTitles = practiceExerciseSequences.map(seq => encodeText(seq.setTitles.join('|'), uniqueTokens, vocabSize));

    // pad titles
    let practiceTitles, maxPracticeTitleLength;
    await padTitles(encodedPracticeTitles).then(data => {
        practiceTitles = data.paddedTitles;
        maxPracticeTitleLength = data.maxLength;
    });
    let setTitles, maxSetTitleLength;
    await padTitles(encodedSetTitles).then(data => {
        setTitles = data.paddedTitles;
        maxSetTitleLength = data.maxLength;
    });

    return { practiceTitles, maxPracticeTitleLength, setTitles, maxSetTitleLength };
}

async function createSetModel() {
    // declare features and labels
    let X, Y, maxXLength, maxYLength;

    // get vocabSize and uniqueTokens
    const { vocabSize, uniqueTokens } = await calculateVocabSizeAndTokenize();

    // Preprocess hierarchical data
    await preprocessData(vocabSize, uniqueTokens).then(data => {
            X = data.practiceTitles;
            maxXLength = data.maxPracticeTitleLength;
            Y = data.setTitles;
            maxYLength = data.maxSetTitleLength;
        });

    // console.log(`${getArrayDimensions(X)} ${getArrayDimensions(Y)}`);

    // Define the model architecture
    const model = tf.sequential();

    // Define hyperparameters
    const embeddingDim = 128;
    const lstmUnits = 128;

    // create layers
    model.add(tf.layers.embedding({inputDim: vocabSize, 
                                   outputDim: embeddingDim, 
                                   inputLength: maxXLength}));                          // embedding
    model.add(tf.layers.lstm({units: lstmUnits, returnSequences: true}));               // encoding
    model.add(tf.layers.lstm({units: lstmUnits}));                                      // decoding
    model.add(tf.layers.dense({units: maxYLength, activation: 'softmax'}));             // output

    // Compile
    model.compile({optimizer: 'adam', loss: 'categoricalCrossentropy'});

    console.log(X);
    // Convert X and Y to tensors
    const XTensor = tf.tensor2d(X);
    const YTensor = tf.tensor2d(Y);

    // Train the model
    try {
        await model.fit(XTensor, YTensor, { epochs: 200, batchSize: 1 });
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
