const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const fs = require('fs');

async function generatePractice() {
    
    // load model
    const modelSource = "file://./Models/V2-Minimizing/model.json";
    const model = await tf.loadLayersModel(modelSource);

    // initialize new tokenizer
    const tokenizer = new natural.WordTokenizer();

    // initialize variables
    const inputLength = 5;
    const numEpochs = 2;
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

    function generateRawPractice(model, seedText, length) {
        let text = tokenizer.tokenize(seedText);

        if(text.length < inputLength){
            throw new Error(`The seedText should contain at least ${inputLength} words`);
        }

        // Start a loop that will run for the specified length of the generated text
        for (let i = 0; i < length; i++) {

            // Slice the last 'inputLength' words from the text array
            // These words will be used as input to the model
            const input = text.slice(-inputLength).map(word => wordIndex[word]);

            // Convert the input array to a 2D tensor, and then expand its dimensions
            // This is necessary because the model expects input in this shape
            const inputTensor = tf.tensor2d([input], [1, inputLength]).expandDims(2);

            // Use the model to predict the next word
            const prediction = model.predict(inputTensor);

            // Convert the prediction tensor to a JavaScript array
            const predictionArray = prediction.arraySync()[0];

            // Calculate the sum of all elements in the prediction array
            const sum = predictionArray.reduce((a, b) => a + b, 0);

            // Normalize the prediction array to get a probability distribution
            const predictionProbabilities = predictionArray.map(value => value / sum);

            // Sample an index from the probability distribution
            const predictedWordIndex = ((probabilities) => {
                let sum = 0;
                const r = Math.random();
                for(let i in probabilities) {
                    sum += probabilities[i];
                    if(r <= sum) return parseInt(i);
                }
            })(predictionProbabilities);

            // Get the predicted word from the 'indexToWord' object
            const predictedWord = indexToWord[predictedWordIndex];

            // Add the predicted word to the text array
            text.push(predictedWord);
        }

        return text.join(' ');
    }
    
    const rawPractice = generateRawPractice(model, 'Warm up 400 freestyle easy', 12);

    // clean up data
    function refinePractice(practice) {
        // cut off extra parts after the practice is finished
        let splitPractice = practice.split(/(Warm up|Main set|Cool down)/);

        // cut off extra "Main" or "Cool"
        let lastElement = splitPractice[splitPractice.length - 1];
        if (lastElement.includes('Main')) { 
            splitPractice[splitPractice.length - 1] = lastElement.replace('Main', '');
        }
        if (lastElement.includes('Cool')) {
            splitPractice[splitPractice.length - 1] = lastElement.replace('Cool', '');
        }

        let refinedPractice = splitPractice.slice(0, 7).join('').trim();
        
        // add intervals
        const distanceRegEx = /([0-9][0-9][0-9])|(50)/;
        if (!refinedPractice.split(distanceRegEx)) { return refinedPractice; }

        const baseInterval = 90;

        let intervalSplit = refinedPractice.split(distanceRegEx);
        intervalSplit = intervalSplit.filter(item => item !== undefined);

        for(let i = 0; i < 3; i++){
            let position = (3 * i) + 1 ;
            let description = intervalSplit[position + 1];
            let distance = intervalSplit[position];

            let speed = 0;
            if (description.includes('easy')) {
                speed = 0;
            } else if (description.includes('moderate')) {
                speed = 1;
            } else if (description.includes('fast')) {
                speed = 2;
            }

            let strokeModifier = 0;
            if (description.includes('freestyle')) {
                strokeModifier = 0;
            } else if (description.includes('backstroke')) {
                strokeModifier = 5;
            } else if (description.includes('butterfly')) {
                strokeModifier = 5;
            } else if (description.includes('breaststroke')) {
                strokeModifier = 10;
            }
            
            let interval = 0;
            switch(speed){
                case 0:
                    interval = (baseInterval + strokeModifier) * distance / 100;
                    interval = Math.round(interval / 5) * 5; // round to nearest 5 seconds
                    break;
                case 1:
                    interval = (baseInterval - 10 + strokeModifier) * distance / 100;
                    interval = Math.round(interval / 5) * 5; // round to nearest 5 seconds
                    break;
                case 2:
                    interval = (baseInterval - 20 + strokeModifier) * distance / 100;
                    interval = Math.round(interval / 5) * 5; // round to nearest 5 seconds
                    break;
            }

            let seconds;
            if (interval % 60 < 10) {
                seconds = "0" + interval % 60;
            } else { seconds = interval % 60; }

            let minutes = Math.floor(interval/60);

            let intervalString = " @ " + minutes + ":" + seconds;
            intervalSplit.splice(position + 1,0,intervalString);
        }

        let intervaledPractice = intervalSplit.slice(0, 10).join('').trim();
        return intervaledPractice;
    }
    
    let finalPractice = refinePractice(rawPractice)

    console.log(finalPractice);
    return finalPractice;
}

// Call the asynchronous function to start the execution
generatePractice().catch(console.error);

module.exports = generatePractice;