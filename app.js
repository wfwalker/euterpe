// experiment with web audio api

// TODO: VU meter like this: http://css.dzone.com/articles/exploring-html5-web-audio
// see also http://www.smartjava.org/examples/webaudio/example2.html

var context;

var shouldrun = false;

window.addEventListener('load', init, false);

function updateclock(context) {
	document.getElementById('audiotime').innerHTML = Math.floor(context.currentTime);
	setTimeout(function() { updateclock(context) }, 1000);
}


function getAverageVolume(array) {
	var values = 0;
	var average;

	var length = array.length;

	// get all the frequency amplitudes
	for (var i = 0; i < length; i++) {
		values += array[i];
	}

	average = values / length;
	return average;
}

function createVolumeMeter(inContext) {
	var volumeMeterCanvas = document.getElementById('volumeMeter');
	var graphicsContext = volumeMeterCanvas.getContext('2d');

	// setup a javascript node
	javascriptNode = inContext.createScriptProcessor(2048, 1, 1);	
	javascriptNode.connect(inContext.destination);

	// setup a analyzer
	var analyser = context.createAnalyser();
	analyser.connect(javascriptNode);
	analyser.smoothingTimeConstant = 0.3;
	analyser.fftSize = 1024;

	javascriptNode.onaudioprocess = function() {
		// get the average, bincount is fftsize / 2
		var array =  new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(array);
		var average = getAverageVolume(array);
		average = Math.max(Math.min(average, 125), 5);

		// clear the current state
		graphicsContext.clearRect(0, 0, 130, 40);

		// set the fill style
		graphicsContext.fillStyle = 'rgb(255,255,255)'

		// create the meters
		graphicsContext.fillRect(130 - average, 25, 130, 30);
	}

	return analyser;
}

function createReverb(inContext) {
	// Again, the context handles the difficult bits
	var convolver = inContext.createConvolver();

	// Wiring
	convolver.connect(inContext.destination);

	// load the impulse response asynchronously
	var request = new XMLHttpRequest();
	request.open("GET", "./Church-Schellingwoude.mp3", true);
	request.responseType = "arraybuffer";

	request.onload = function () {
		var bufferSize = 2 * inContext.sampleRate;
		convolver.buffer = inContext.createBuffer(2, bufferSize, inContext.sampleRate);

		context.decodeAudioData(request.response, function(buffer) {
			convolver.buffer = buffer;
			console.log("loaded impulse response");
		}, function (error) {
			console.log("error " + error);
		});

		// convolver.buffer = inContext.createBuffer(2, request.response, false);
	}

	request.send();

	return convolver;
}

function hihat(inGain, time) {
	if (shouldrun) {
		inGain.gain.setValueAtTime(0.9, time);
		inGain.gain.linearRampToValueAtTime(0, time + 0.1);

		inGain.gain.setValueAtTime(0.5, time + 1);
		inGain.gain.linearRampToValueAtTime(0, time + 1.1);

		inGain.gain.setValueAtTime(0.7, time + 2);
		inGain.gain.linearRampToValueAtTime(0, time + 2.1);

		inGain.gain.setValueAtTime(0.5, time + 3);
		inGain.gain.linearRampToValueAtTime(0, time + 3.1);
	}

	setTimeout( function() { hihat(inGain, time + 4); }, 4000);
}

// thanks to http://noisehack.com/generate-noise-web-audio-api/
function createWhiteNoiseSource(inContext, inReverb, inAnalyzer, inStartTime) {
	var bufferSize = 2 * inContext.sampleRate;
	noiseBuffer = inContext.createBuffer(1, bufferSize, inContext.sampleRate);
	output = noiseBuffer.getChannelData(0);
	for (var i = 0; i < bufferSize; i++) {
		output[i] = Math.random() * 2 - 1;
	}

	whiteNoise = inContext.createBufferSource();
	whiteNoise.buffer = noiseBuffer;
	whiteNoise.loop = true;

	// create gain, wire up to noise
	gain = inContext.createGain();
	whiteNoise.connect(gain);

	// create panner, wire up to gain
	panner = inContext.createPanner();
	panner.setPosition(Math.random() * 10 - 5, Math.random() * 10 - 5, 0);
	gain.connect(panner);

	// wire up panner to destination and analyzer
	panner.connect(inAnalyzer);
	panner.connect(inReverb);

	// initialize gain.gain, start whitenoise
	gain.gain.value = 0;
	whiteNoise.start(0);

	hihat(gain, inStartTime);
}

// schedules ongoing events to make triangular envelopes for an oscillator and gain node
// inspired by http://www.html5rocks.com/en/tutorials/audio/scheduling/

function octavizer(inOscillator, inGain, inBaseFreq, time) {
	if (shouldrun) {	
		// instant on, ramp down
		inOscillator.frequency.setValueAtTime(inBaseFreq, time + 1);
		inGain.gain.setValueAtTime(Math.random(), time + 1);
		inGain.gain.linearRampToValueAtTime(0, time + 1 + 0.1 + Math.random());

		// instant on, ramp down
		otherFreq = inBaseFreq * (1 + Math.floor(Math.random() * 3));
		inOscillator.frequency.setValueAtTime(otherFreq, time + 3);
		inGain.gain.setValueAtTime(Math.random(), time + 3);
		inGain.gain.linearRampToValueAtTime(0, time + 3 + 0.1 + Math.random());
	}	

	setTimeout( function() { octavizer(inOscillator, inGain, inBaseFreq, time + 4); }, 4000);
}

function initializeOctavizer(inContext, inReverb, inAnalyzer, inStartTime, inBaseFreq) {
	// create oscillator
	oscillator = inContext.createOscillator();
	types = ['square', 'triangle', 'sine', 'sawtooth'];
	oscillator.type = types[Math.floor(Math.random() * types.length)];
	oscillator.frequency.value = inBaseFreq;

	// create gain, wire up to oscillator
	gain = inContext.createGain();
	oscillator.connect(gain);

	// create panner, wire up to gain
	panner = inContext.createPanner();
	panner.setPosition(Math.random() * 10 - 5, Math.random() * 10 - 5, 0);
	gain.connect(panner);

	// wire up panner to destination and analyzer
	panner.connect(inReverb);
	panner.connect(inAnalyzer);

	// turn down gain, start oscillator
	gain.gain.value = 0;
	oscillator.start(0);

	octavizer(oscillator, gain, inBaseFreq, inStartTime);
}

function init() {
	// Fix up for prefixing
	window.AudioContext = window.AudioContext||window.webkitAudioContext;
	context = new AudioContext();

	var theAnalyzer = createVolumeMeter(context);

	var theReverb = createReverb(context);

	createWhiteNoiseSource(context, theReverb, theAnalyzer, 5);
	createWhiteNoiseSource(context, theReverb, theAnalyzer, 9.5);
	createWhiteNoiseSource(context, theReverb, theAnalyzer, 13.25);
	createWhiteNoiseSource(context, theReverb, theAnalyzer, 17.75);
	createWhiteNoiseSource(context, theReverb, theAnalyzer, 21.125);

	initializeOctavizer(context, theReverb, theAnalyzer, 1, 220);
	initializeOctavizer(context, theReverb, theAnalyzer, 1.125, 440);
	initializeOctavizer(context, theReverb, theAnalyzer, 1.25, 220);
	initializeOctavizer(context, theReverb, theAnalyzer, 1.5, 220);
	initializeOctavizer(context, theReverb, theAnalyzer, 1.75, 110);
	initializeOctavizer(context, theReverb, theAnalyzer, 2, 220);
	initializeOctavizer(context, theReverb, theAnalyzer, 2.25, 440);
	initializeOctavizer(context, theReverb, theAnalyzer, 2.5, 220);
	initializeOctavizer(context, theReverb, theAnalyzer, 2.75, 880);
	updateclock(context);

	document.getElementById('onoff').addEventListener('click', function(e) {
		shouldrun = ! shouldrun;

		if (this.innerHTML == '- O') {
			this.innerHTML = 'O -';
		} else {
			this.innerHTML = '- O';
		}

		console.log("should run " + shouldrun);
	});
}
