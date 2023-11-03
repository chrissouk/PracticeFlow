const fs = require('fs');
const path = require('path');

function generateTrainingSession() {
    // variables
    const distances = [50, 100, 150, 200, 250, 300, 350, 400];
    const strokes = ['freestyle', 'butterfly', 'breaststroke', 'backstroke'];
    const intensities = ['easy', 'moderate', 'fast'];
    const repetitions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    function getRandomElement(array, options) {
      if(!options) {
        return array[Math.floor(Math.random() * array.length)];
      } else {
        let optionArray = [];
        for(let i = 0; i < options.length; i++) {
          optionArray.push(array[options[i]]);
        }
        return optionArray[Math.floor(Math.random() * optionArray.length)];
      }
    }

    // generate warm-up
    let warmup = `Warm up: ${getRandomElement(distances, [3,4,5,6,7])} ${getRandomElement(strokes, [0,3])}, easy. `;

    // generate main set
    let mainSet = `Main set: ${getRandomElement(repetitions)} x ${getRandomElement(distances)} ${getRandomElement(strokes)} ${getRandomElement(intensities)}. `;

    // generate cool down
    let coolDown = `Cool down: ${getRandomElement(distances)} ${getRandomElement(strokes, [0,3])}, easy.`;

    return warmup + mainSet + coolDown;
}

// generate 0 sessions and append them to the file
// > 10 000 to get good results
let sessionCount = 0;
let fileName = '';
for (let i = 0; i < sessionCount; i++) {
  let session = generateTrainingSession();
  fs.appendFileSync(path.join(__dirname, fileName), session + '\n', 'utf8');
}