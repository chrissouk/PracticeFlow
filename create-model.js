const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const fs = require('fs');

async function createModel() {
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

    // create model
    const model = tf.sequential();
    model.add(tf.layers.lstm({units: 128, inputShape: [inputLength, 1]}));
    model.add(tf.layers.dense({units: numWords, activation: 'softmax'}));
    
    // compile model
    model.compile({loss: 'categoricalCrossentropy', optimizer: 'adam'});
    
    // generate training data
    const X = [];
    const Y = [];

    for (let i = 0; i < practicePlans.length; i++) {
        const practicePlan = practicePlans[i];
        const tokenizedPlan = tokenizer.tokenize(practicePlan);

        for (let j = 0; j < tokenizedPlan.length - inputLength; j++) {
            X.push(tokenizedPlan.slice(j, j + inputLength).map(word => wordIndex[word]));
            Y.push(wordIndex[tokenizedPlan[j + inputLength]]);
        }
    }
    
    // convert data to tensors
    let XTensor;
    if (X.length > 0) {
        XTensor = tf.tensor2d(X, [X.length, X[0].length]);
        XTensor = XTensor.expandDims(2);
    } else {
        throw new Error("The array X is empty. Unable to create tensor.");
    }
    const YTensor = tf.oneHot(tf.tensor1d(Y, 'int32'), numWords);
    
    // train model
    await model.fit(XTensor, YTensor, { epochs: numEpochs, batch_size: batchSize });

    // save model
    await model.save('file://./Models/');
}

// Call the asynchronous function to start the execution
createModel().catch(console.error);