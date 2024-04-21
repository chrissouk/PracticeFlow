const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const path = require('path');

const tokenizer = new natural.WordTokenizer();

// Load the tokenIndexMap from the file
const tokenIndexMap = JSON.parse(fs.readFileSync(path.join(__dirname, './Models/V4-PreMassData/vocab.json'), 'utf8'));
// Convert the tokenIndexMap back into a Map for easy lookup
const uniqueTokensMap = new Map(tokenIndexMap.map(({ key, value }) => [key, value]));
// Derive vocab from uniqueTokensMap
const vocab = new Set(uniqueTokensMap.keys());

// get max input length
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Models/V4-PreMassData/maxXLength.json'), 'utf8'));
const maxXLength = data.maxXLength;

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

// Load the model
async function loadModel() {
    const model = await tf.loadLayersModel('file://./Models/V4-PreMassDatamodel.json');
    return model;
}

// assign each unique token with its integer representation
function encode(text) {

    const tokens = tokenizer.tokenize(text);

    // Initialize an array to hold the encoded integers for each token, plus initialize the start token
    let tokenizedText = [];

    // remap tokens as integer representations
    tokens.forEach(token => {
        const value = Array.from(vocab).indexOf(token);
        if (value !== -1) {
            tokenizedText.push(value);
        }
    });

    return tokenizedText;
}

// pad titles
async function pad(arr) {

    // Step 2: Pad each inner array with zeros at the beginning to match the length of the longest inner array
    const paddingLength = maxXLength - arr.length;
    const padding = new Array(paddingLength).fill(0);
    const paddedItem = padding.concat(arr);

    return paddedItem;
}

// Generate set titles
async function generateNextToken(model, text) {
    // Preprocess practice titles
    const encodedInput = encode(text);
    const paddedInput = await pad(encodedInput);
    console.log(paddedInput);

    // Convert to tensor
    const inputTensor = tf.tensor2d(paddedInput, [1, maxXLength]);

    // Generate predictions
    const predictions = model.predict(inputTensor).dataSync();
    console.log(predictions);

    // find chosen token index
    let chosenTokenProbability = predictions[0];
    let chosenTokenIndex = 0;
    for (let i = 0; i < predictions.length; i++) {
        if (predictions[i] > chosenTokenProbability) {
            chosenTokenProbability = predictions[i];
            chosenTokenIndex = i;
        }
    }

    // decode chosenToken
    let vocabArray = Array.from(vocab);
    let chosenToken = vocabArray[chosenTokenIndex];

    return chosenToken;
}

// Main function
async function main() {
    const model = await loadModel();

    const practiceTitle = 'Sprint';

    let tokens = [];
    tokens.push("PRACTICETITLE");
    tokens.push(practiceTitle.toLowerCase());

    let i = 0;
    while (tokens[tokens.length - 1] !== "STOP" && i < 1500){
        console.log(tokens.join(' '));
        let newToken = await generateNextToken(model, tokens.join(' '));
        tokens.push(newToken);
        i++;
    }

    console.log(tokens);

}

main().catch(console.error);