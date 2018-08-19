window.addEventListener('load', function() {
	var audio, phrase_no;
	var phrases = [];
	var dmp = new diff_match_patch();
	dmp.Diff_Timeout = parseFloat(100);	
	dmp.Diff_EditCost = parseFloat(4);

	var isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

	var $pages = {
		text: document.querySelector('#page-text'),
		phrase: document.querySelector('#page-phrase'),
		help: document.querySelector('#page-help') 
	}	

	var $buttons = {
		continue: document.querySelector('#button-continue'),
		record: document.querySelector('#button-record'),
		listen: document.querySelector('#button-listen'),
		prev_phrase: document.querySelector('#button-prev-phrase'),
		next_phrase:document.querySelector('#button-next-phrase'),
		record: document.querySelector('#button-record'),
		help: document.querySelector('#button-help')
	}

	var $text = document.querySelector('#text');
	var $texts = document.querySelector('#texts');
	var $phrase = document.querySelector('#phrase');
	var $phrase_number = document.querySelector('#phrase-number');
	var $voices = document.querySelector('#panel-speak #voices');
	var $voice_speed = document.querySelector('#voice-speed');	
	var $recognition = document.querySelector('#recognition');
	var $compare = document.querySelector('#compare');

	for (var name in texts) {
		var $option = document.createElement('option');
		$option.setAttribute('value', name);
		$option.innerHTML = name;
		$texts.appendChild($option);
	};

	$texts.addEventListener('change', (event) => $text.value = texts[event.target.value]);
	var current_text_no = localStorage && localStorage.getItem('text_no') || $texts.value;
	$text.innerHTML = texts[current_text_no];
	$texts.value = current_text_no;

	function setPhrase(no) {
		if (no < 0)
			return setPhrase(0);

		if (no > phrases.length - 1)
			return setPhrase(phrases.length - 1);

		$pages.phrase.style.display = 'flex';
		$phrase.innerHTML = phrases[no].split(' ').map((e) => '<span>' + e + '</span>').join(' ');
		$phrase.querySelectorAll('*').forEach((e) => e.addEventListener('click', speakWord));
		$phrase_number.innerHTML = (no + 1) + '/' + phrases.length;
		$buttons.prev_phrase.style.visibility = no == 0 ? 'hidden' : 'visible';
		$buttons.next_phrase.style.visibility = no == phrases.length - 1 ? 'hidden' : 'visible';
		$voice_speed.value = localStorage && localStorage.getItem('voice-speed') || 1;
		$recognition.innerHTML = '&nbsp;';
		$recognition.removeAttribute('correct');
		$recognition.removeAttribute('confidence');
		$compare.innerHTML = '';
		$buttons.listen.setAttribute('hidden', true);
		$buttons.record.removeAttribute('record');

		phrase_no = no;
	}

	function speakWord () {
		var evt = new CustomEvent('speak-word', {detail: this.textContent});
		document.dispatchEvent(evt);
	}

	$buttons.continue.addEventListener('click', function () {
		if (localStorage)
			localStorage.setItem('text_no', $texts.value);

		phrases = $text.value.split('\n').map((e) => e.trim());

		$pages.text.style.display = 'none';
		setPhrase(0);
	});

	if (window.speechSynthesis) {
		var voices = [];
		var current_voice = localStorage && localStorage.getItem('voice') || 2;
		$voice_speed.addEventListener('input', (event) => localStorage && localStorage.setItem('voice-speed', event.target.value));

		function speakPhrase(event) {
			current_voice = event.target.getAttribute('voice') || 2;
			if (localStorage)
				localStorage.setItem('voice', current_voice);

			var utterance = new SpeechSynthesisUtterance(document.querySelector('#phrase').textContent);
			utterance.voice = voices[current_voice];
			utterance.rate = $voice_speed.value || 1;
			speechSynthesis.speak(utterance);			
		}

		document.addEventListener('speak-word', function (event) {
			var utterance = new SpeechSynthesisUtterance(event.detail);
			utterance.voice = voices[current_voice];
			utterance.rate = $voice_speed.value || 1;
			speechSynthesis.speak(utterance);
		})

		function loadVoices () {
			$voices.innerHTML = '';
			voices = window.speechSynthesis.getVoices();
			voices.forEach(function(e, i) {
				if (e.lang.indexOf('en') == 0 && (e.lang.indexOf('US') != -1 || e.lang.indexOf('UK') != -1 || e.lang.indexOf('GB') != -1)) {
					var $voice = document.createElement('div');
					$voice.setAttribute('class', 'button speak');
					$voice.setAttribute('voice', i);
					$voice.setAttribute('title', e.name);
					$voice.innerHTML = '&#1010' + ($voices.children.length + 2) + ';'; 
					$voices.appendChild($voice);
				}	
			});
			
			for (var i = 0; i < $voices.children.length; i++) 
				$voices.children[i].addEventListener('click', speakPhrase);
		}
		
		loadVoices();
		if (window.speechSynthesis.onvoiceschanged !== undefined) {
			window.speechSynthesis.onvoiceschanged = loadVoices;
		}
	}
	
	function playAudio() {
		if (!audio)
			return;

		var url = URL.createObjectURL(audio);
		new Audio(url).play();
	}
	$buttons.listen.addEventListener('click', playAudio);
	
	function closePage() {
		$pages.text.style.display = 'block';
		$pages.phrase.style.display = 'none';
		$pages.help.style.display = 'none';
	} 
	document.querySelectorAll('.close').forEach(($e) => $e.addEventListener('click', closePage));

	$buttons.prev_phrase.addEventListener('click', () => setPhrase(phrase_no - 1));
	$buttons.next_phrase.addEventListener('click', () => setPhrase(phrase_no + 1));

	function showHelp() {
		$pages.text.style.display = 'none';
		$pages.help.style.display = 'block';
	}
	$buttons.help.addEventListener('click', showHelp);
	
	navigator.mediaDevices.getUserMedia({audio: true}).then (function (stream) {
		var recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
		if (!recognition) 
			return;
		
		$pages.phrase.removeAttribute('attention');
		var chunks;

		var mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.addEventListener('dataavailable', event => chunks.push(event.data));

		function startRecord(event) {
			if (event.type != 'touchstart' && event.type == 'mousedown' && event.which != 1)
				return;

			$buttons.record.setAttribute('record', true);
			$compare.innerHTML = '';

			chunks = [];
			audio = null;

			mediaRecorder.start();
			if (recognition) {
				recognition.lang = isMobile ? 'en-US' : 'en-UK';
				recognition.onresult = function (event) {
					var res = event.results[0][0];
					$recognition.innerHTML = res.transcript;
					$recognition.setAttribute('confidence', ((+res.confidence).toFixed(2) * 100) + '%');

					var clear = (text) => text.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
					var phrase = clear($phrase.textContent);
					var transcript = clear(res.transcript);

					var compare = '';
					if (phrase != transcript) {
						var d = dmp.diff_main(phrase, transcript);
						dmp.diff_cleanupEfficiency(d);
						compare = dmp.diff_prettyHtml(d);
					}
					
					$compare.innerHTML = compare;
					$recognition.setAttribute('correct', phrase == transcript);
				}

				recognition.continuous = false;
				recognition.interimResults = false;
				recognition.start();
			}
		}

		function stopRecord(event) {
			if (event.type != 'touchend' && event.type == 'mouseup' && event.which != 1)
				return;

			mediaRecorder.stop();
			$buttons.listen.removeAttribute('hidden');
			$buttons.record.removeAttribute('record');

			if (recognition)
				recognition.stop();

			setTimeout(() => audio = new Blob(chunks, {type : 'audio/ogg; codecs=opus'}), 500);
		}

		$buttons.record.addEventListener(isMobile ? 'touchstart' : 'mousedown', startRecord);
		$buttons.record.addEventListener(isMobile ? 'touchend' : 'mouseup', stopRecord);
	}).catch(alert);
});