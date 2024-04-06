const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');

// Load the model
async function loadModel() {
    const model = await tf.loadLayersModel('file://./Models/V3-RealData/model.json');
    return model;
}

// Tokenize and encode a title
function encodeTitle(title, uniqueTokens) {
    const tokens = new natural.WordTokenizer().tokenize(title);
    let encodedTitle = [];
    tokens.forEach(token => {
        const index = Array.from(uniqueTokens).indexOf(token);
        if (index !== -1) {
            encodedTitle.push(index + 1);
        }
    });
    return encodedTitle;
}

// Pad titles
async function padTitles(title, maxLength) {
    const paddedTitle = [...title];
    const paddingLength = maxLength - title.length;
    for (let i = 0; i < paddingLength; i++) {
        paddedTitle.push(0);
    }
    return paddedTitle;
}

// Generate set titles
async function generateSetTitles(model, practiceTitle, uniqueTokens, maxLength) {
    // Preprocess practice titles
    const encodedPracticeTitle = practiceTitle.map(title => encodeTitle(title, uniqueTokens));
    const paddedPracticeTitle = await padTitle(encodedPracticeTitle, maxLength);

    // Convert to tensor
    const inputTensor = tf.tensor2d(paddedPracticeTitle);

    // Generate predictions
    const predictions = model.predict(inputTensor);

    // Decode predictions
    const decodedTitles = predictions.dataSync().map(index => Array.from(uniqueTokens)[index - 1]);

    return decodedTitles;
}

// Main function
async function main() {
    const model = await loadModel();

    // Load unique tokens and max length from training data
    // This should be done in a similar way as in create-set-model.js
    // For simplicity, let's assume they are loaded here
    const uniqueTokens = new Set(['your', 'unique', 'tokens', 'here']);
    const maxLength = 10; // Example max length

    // Example practice titles
    const practiceTitle = ['Sprint'];

    const setTitles = await generateSetTitles(model, practiceTitles, uniqueTokens, maxLength);
    console.log(setTitles);
}

main().catch(console.error);