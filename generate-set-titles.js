const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const path = require('path');

// Load the tokenIndexMap from the file
const tokenIndexMap = JSON.parse(fs.readFileSync(path.join(__dirname, './Models/V3-RealData/uniqueTokens.json'), 'utf8'));
// Convert the tokenIndexMap back into a Map for easy lookup
const uniqueTokensMap = new Map(tokenIndexMap.map(({ key, value }) => [key, value]));
// Derive uniqueTokens from uniqueTokensMap
const uniqueTokens = new Set(uniqueTokensMap.keys());

// get max input length
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Models/V3-RealData/maxXLength.json'), 'utf8'));
const maxXLength = data.maxXLength;

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

// Load the model
async function loadModel() {
    const model = await tf.loadLayersModel('file://./Models/V3-RealData/model.json');
    return model;
}

// assign title words to their integer representation
function encodeTitle(title) {
    const tokens = new natural.WordTokenizer().tokenize(title);
    let encodedTitle = [];
    tokens.forEach(token => {
        const index = uniqueTokensMap.get(token);
        if (index !== -1) {
            encodedTitle.push(index + 1);
        }
    });
    return encodedTitle;
}

// Pad titles
async function padTitle(title) {
    const paddingLength = maxXLength - title.length;
    for (let i = 0; i < paddingLength; i++) {
        title.push(0);
    }
    return title;
}

// Generate set titles
async function generateSetTitles(model, practiceTitle) {
    // Preprocess practice titles
    const encodedPracticeTitle = encodeTitle(practiceTitle);
    const paddedPracticeTitle = await padTitle(encodedPracticeTitle);

    console.log(paddedPracticeTitle);

    // Convert to tensor
    const inputTensor = tf.tensor2d(paddedPracticeTitle, [1, maxXLength]);

    // Generate predictions
    const predictions = model.predict(inputTensor);

    // Decode predictions
    const decodedTitle = predictions.dataSync().map(index => Array.from(uniqueTokens)[index - 1]);

    return decodedTitle;
}

// Main function
async function main() {
    const model = await loadModel();

    // Example practice titles
    const practiceTitle = 'Warm Up';

    const setTitles = await generateSetTitles(model, practiceTitle);
    console.log(setTitles);
}

main().catch(console.error);