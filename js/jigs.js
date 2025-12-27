function loadScript(src, callback) {
  const script = document.createElement('script');
  script.src = src;
  script.onload = callback;
  document.head.appendChild(script);
}

loadScript('https://code.highcharts.com/highcharts.js', function () {
  loadScript('https://code.highcharts.com/modules/histogram-bellcurve.js');
  loadScript('https://code.highcharts.com/modules/exporting.js');
  loadScript('https://code.highcharts.com/modules/export-data.js');
});

const colors = {
    selection  : '#a6a6a6',
    joke       : "#9b59b6",
    jabline    : "#3498db",
    punchline  : "#2ecc71",
}

const fixedLists = {
	jokeCols: [
			["so_actual_non","bool"], 	["so_normal_abnormal","bool"],		["so_possible_impossible", "bool"],
			["so_good_bad", "bool"],	["so_life_death", "bool"],			["so_obscenity", "bool"],
			["so_money", "bool"],		["so_high_low_stature", "bool" ],	["so_human_non", "bool" ],
			["s1_s2", "text"],			["si", "text"], 					["ta", "text"],
			["la", "text"],				["la_argot", "bool"],				["la_cacography", "bool"],
			["comment", "text"],
	],
	jokeRelatedSame: [ "lm_type", "ta_label", "ns", "versification_mechanism" ],
};

const api = {
	models:    'https://lindat.mff.cuni.cz/services/udpipe/api/models',
	tokenizer: 'https://lindat.mff.cuni.cz/services/udpipe/api/process?tokenizer',
	stanzaSep: 'STNZBRK',
	lineSep:   'LNBRK',
};

var tokens = [];
var rireTags = {};
var selectedWordRange = {'min': null, 'max': null};
var editingExistingTags = false;

var availableTags = {
	lm_type: [
		"ambiguity", "anagramme", "exageration", "faulty_logic", "garden_path", "homonymy", "homophony", "juxtaposition", "mapping", "meta", "metaphor", "metonymy", 
		"negation", "personnification", "polysemy", "priming", "register", "repetition", "reversal",
	],
	ta_label: [
		"class", "community", "female", "gender", "genre", "humankind", "institution", "jews", "lower_class", "male", "military", "place", 
		"politics", "race", "racisme", "religion", "self", "state", "upper_class",
	],
	ns: [
		"QA", "narrative", "narrative_QA", "other_address", "other_description", "other_list", "other_other_injunction"
	],
	versification_mechanism: [
		"caesura", "rhyme", "enjambment"
	],
}

/* ==================== INITIALIZE JIGS ======================================= */


function startJigs(id, defaultModel=null){
	/*
	Render JIGS interface into an element with given ID
	*/
	$('#'+id).addClass('mainframe');
	JqueryUIinit();
	addControlPanel(id);
	addInputs(id, defaultModel);
    addTaggingInterface(id);
	addStatsPanel();
}

function JqueryUIinit(){
	/*
	Initialize JQuery UI elements
	*/
	$( ".widget input[type=submit], .widget a, .widget button" ).button();
	$( "#p-model" ).selectmenu();
}

function addControlPanel(id){
	/*
	Add control panel to the interface (buttons in the top)
	*/
	$('#'+id).append('<div id="control-panel"></div>');
	$('#'+id).append('<div id="mainframe-label">JIGS</div>');
	$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-plain">Load plaintext</button>');
    $('#control-panel').append('<input type="file" id="input-plain"></input>');
	//$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-xml">Load XML</button>');
	$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-json">Load JSON</button>');
    $('#control-panel').append('<input type="file" id="input-json" accept=".json"></input>');
	$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-tokenize">Tokenize</button>');
	//$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-xml-out">Export XML</button>');
	$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-json-out">Export JSON</button>');
	$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-stats">Show stats</button>');
	$('#control-panel').append('<button class="ui-button ui-widget ui-corner-all" id="btn-restart">New text</button>');
}

function addInputs(id, defaultModel){
	/*
	Add user inputs (title / author / model / text)
	*/
	$('#'+id).append('<div class="ui-widget"><label for="p-title"  class="p-label">title: </label><input id="p-title"></div>');
	$('#'+id).append('<div class="ui-widget"><label for="p-author" class="p-label">author: </label><input id="p-author"></div>');
	$('#'+id).append('<div class="ui-widget"><label for="p-model"  class="p-label">model: </label><select id="p-model"></select</div>');
	$('#'+id).append('<div id="p-text-bin" class="ui-widget"><label for="p-author" class="p-label">text: </label><textarea id="p-text"></textarea></div>');
	getModels(defaultModel);
}

function addTaggingInterface(id){
    /*
    Add elements where poem tagging is performed
    */
    $('#'+id).append('<table id="el-poem"></table>');
    $('#'+id).append('<div id="modal"></div>');
    $('#'+id).append('<div id="popup-over-screen"><div id="popup-over-screen-content"></div></div>');
}

function addStatsPanel(){
	/*
	Add panel with JOLI stats
	*/
	$('body').append('<div id="stats-bin"><div id="stats-top"><div id="btn-closer">×</div></div><div id="stats-inner"><div id="stats-content"></div></div><div id="stats-bottom"></div></div>');
}

function getModels(defaultModel){
	/*
	Get a list of available UD Pipe models
	*/
	fetch(api.models)
	.then(response => {
		if (!response.ok) {
			console.log('UDPipe: Network response was not ok');
		}
		return response.json();
	})
	.then(data => {
		renderModels(data, defaultModel)
	})
	.catch(error => {
		console.error('UDPipe error:', error);
	});
}

function renderModels(data, defaultModel){
	/*
	Render available UDPipe models to the selectmenu. Preselect the default one if specified.
	*/
	let selected = false;
	for (model in data.models){
		if ( defaultModel !== null && selected === false && model.startsWith(defaultModel) ) {
			$('#p-model').append($('<option>', {text: model, selected: true}));
			selected = true;
		} else {
			$('#p-model').append($('<option>', {text: model}));
		}
	}
}

/* ==================== TOKENIZATION ======================================= */

function preprocess_text(){
	/*
    Clean input text
	*/
	let t = $('#p-text').val().trim();
	t = t.replace(/[\r\n][\r\n]/g, ' ' + api.stanzaSep + ' ');
	t = t.replace(/[\r\n]/g, ' ' + api.lineSep + ' ');
	t = t.replace(/ +/g,' ');
	return t
}

function tokenize(t){
	/*
    Tokenize preprocessed input text by means of UDPipe API and pass it to parseTokenizedText()
	*/
	fetch(api.tokenizer + '&model=' + $('#p-model').find(":selected").text() + '&data=' + t)
	.then(response => {
		if (!response.ok) {
			console.log('UDPipe: Network response was not ok');
		}
		return response.json();
	})
	.then(data => {
		parseTokenizedText(data.result);
	})
	.catch(error => {
		console.error('UDPipe error:', error);
	});	
}

function parseTokenizedText(data){
	/*
    Parse CONLLU into a list of tokens with following structure:
    [
        {
            form       [str]  word form 
            w          [int]  word id     (unique)
            l          [int]  line id     (restarts in each stanza)
            s          [int]  stanza id,   
            spaceAfter [bool] whether word should be followed by blankspace 
        },
        ...
    ]
	*/
	tokens = [];
	let wordId   = 1;
	let lineId   = 1;
	let stanzaId = 1;
	let multiwordFlag = false;
	let multiwordEnds = null;
	for (l of data.trim().split(/\r?\n/)){
		if (l.startsWith('#')){
			continue;
		}
		if (l.trim() == 0){
			continue;
		}
		let items = l.split('\t');
		let space = true;

		if ( multiwordFlag == true ){
			if (multiwordEnds == items[0]){
			 	multiwordFlag = false;
				multiwordEnds = null;
				continue;
			} else {
				continue;
			}
		}
		if (items[0].indexOf('-') > -1 ){
			multiwordFlag = true;
			multiwordEnds = items[0].split('-')[1];
		}
		if (items[1] == api.stanzaSep){
			stanzaId++;
			lineId = 1;
			continue;
		}
		if (items[1] == api.lineSep){
			lineId++;
			continue;
		}
		if ( items[items.length - 1] == 'SpaceAfter=No'){
			space = false;
		}
		let token = {form: items[1], w: wordId, l: lineId, s: stanzaId, spaceAfter: space}
		wordId++;
		tokens.push(token)
	}
	renderTokenizedText(tokens);
}

function renderTokenizedText(tokens){
    /*
    Render tokenized text into DOM
    */
    $('#btn-plain').hide();
    $('#btn-xml').hide();
    $('#btn-json').hide();
    $('#btn-tokenize').hide();
    $('#p-text-bin').hide();
    $('#p-model').prop('disabled', true);;
    
    var s_last = null;
    var l_last = null;
    var i = 0;
    var poem = '';
    for (token of tokens){
        if (token.s != s_last){
            if (i > 0){
                poem += '</td></tr>'; 
            }
            poem += '<tr><td></td><td><div class="lg-sep"></div></td></tr>';
            poem += '<tr><td class="el-l-id">'+token.s+'.'+token.l+'</td><td class="el-l">';
        } else if (token.l != l_last){
            if (i > 0){
                poem += '</td></tr>'; 
            }
            poem += '<tr><td class="el-l-id">'+token.s+'.'+token.l+'</td><td class="el-l">';
        } 
        poem += '<div class="el-w" data-id="'+token.w+'">'+token.form;
        if (token.spaceAfter === true){
            poem += ' '
        }
        poem +='</div>';
        s_last = token.s;
        l_last = token.l;
        i++;
    }
    poem += '</td></tr>';
    $('#el-poem').append(poem);
    $('#btn-xml-out').show();
    $('#btn-json-out').show();
    $('#btn-stats').show();
    $('#btn-restart').show();
    $('#el-poem').show();

}

/* ==================== ANNOTATION ======================================= */

function wordTrigger(wId) {
	/*
	Handle word clicking
	*/
	// If no word selected so far
	if ( selectedWordRange['min'] == null || editingExistingTags ) {
		editingExistingTags = false;
		deselectAll();
		selectedWordRange = {'min': wId, 'max': wId};
		wordsBackgroundColor(colors.selection)
		brandNewModal(wId);
		initialModal();
	// If selected word is to the left from selection
	} else if ( parseInt(wId) < parseInt(selectedWordRange['min']) ) {
		selectedWordRange['min'] = wId;
		wordsBackgroundColor(colors.selection)
	// If selected word is to the right from selection
	} else if ( parseInt(wId) > parseInt(selectedWordRange['max']) ) {
		selectedWordRange['max'] = wId;
		wordsBackgroundColor(colors.selection)
	// If word within selection
	} else {
		deselectAll();
	}
}

function wordsBackgroundColor(col) {
	/*
	Change background color of all words within selection
	*/
	for ( var wId = parseInt(selectedWordRange['min']); wId <= parseInt(selectedWordRange['max']); wId++ ){
		$('.el-w[data-id='+wId+']').css('background-color', col);
	}
}

function deselectAll() {
	/*
	Deselect all tag-boxes and xline-boxes and words and hide modal
	*/

	$( ".tagBox" ).each(function( index ) {
		$( this ).css('backgroundColor', $( this ).attr('data-col'));
	});
	$( ".jablineBox" ).each(function( index ) {
		$( this ).css('backgroundColor', $( this ).attr('data-col'));
	});
	$( ".punchlineBox" ).each(function( index ) {
		$( this ).css('backgroundColor', $( this ).attr('data-col'));
	});
	wordsBackgroundColor('transparent')
	selectedWordRange = {'min': null, 'max': null};
	$('#modal').html('');
	$('#modal').hide();
}

function brandNewModal(id){
	/*
	Remove current modal (if exists) and create an empty new one below the word with specified id
	*/

	$('#modal').html('');
	$('#modal').hide();
	$('#modal').css({'top': $('.el-w[data-id='+id+']').offset().top+60, 'left': $('.el-w[data-id='+id+']').offset().left});
	$('#modal').show();
	$('#modal').append('<div id="modal-closer" onclick="deselectAll()">×</div>');
	$('#modal').draggable();
}

function initialModal(){
	/*
	Open initial modal allowing to select which table to edit
	*/

	// Add buttons to select which table should be edited
	$('#modal').append(
		'<center>' +
		'<p><button id="jokeButton" style="width:160px"><span>■■■</span> JOKE <span>■■■</span></button>' +
		'<p><button id="jablineButton" style="width:160px" disabled><span>■■■</span> JABLINE <span>■■■</span></button>' +
		'<p><button id="punchlineButton" style="width:160px" disabled><span>■■■</span> PUNCHLINE <span>■■■</span></button>' +
		'<p><div id="jab-punch-notice" style="max-width:150px">jabline and punchline may be insterted only into an already defined joke</div>' +
		'</center>'
	);

	// Check if click was inside already defined joke (enable jabline & punchline buttons)
	// + color the markers on buttons
	for ( var i in rireTags ){
		if ( selectedWordRange['min'] >= parseInt(rireTags[i]['loc_start']) && selectedWordRange['min'] <= parseInt(rireTags[i]['loc_end']) ){
			$('#jablineButton').prop('disabled', false);
			$('#punchlineButton').prop('disabled', false);
			$('#jablineButton > span').css('color', colors.jabline);
			$('#punchlineButton > span').css('color', colors.punchline);
			$('#jab-punch-notice').hide();
		}
	}
	$('#jokeButton > span').css('color', colors.joke);

	// Button actions
	$('#jokeButton').click(function(){ jokeModal(true); });
	$('#jablineButton').click(function(){ lineModal('jabline', true); });
	$('#punchlineButton').click(function(){ lineModal('punchline', true); });
}

function jokeModal(allowEdits){
	/*
	Show modal for joke-table
	*/

	// Modal closer
	$('#modal').html('<div id="modal-closer" onclick="deselectAll()">×</div>');

	// Table marker
	$('#modal').append('<div id="tableMarker" >■■■</div>');
	$('#tableMarker').css('color', colors.joke);

	// Container for menus
	$('#modal').append('<div id="modalMenuContainer"></div>');

	// Add input fields
	var ji = jokeInputs()
	var oi = outerJokeInputs()
	$('#modalMenuContainer').append(
		'<table><tr><td class="modal-td1">' + ji + '</td><td class="modal-td2">' + oi + '</td></tr></table>'
	);


    if ( allowEdits === true ){
    	// Submit  button
        $('#modal').append('<p><center><button id="submit-joke-btn">SAVE</button></center>');
    	// Assign button actions
	    jokeButtonActions();
    } else {
        $("#modal input").prop( "disabled", true );
        $("#modal textarea").prop( "disabled", true );
        $("#modal button").prop( "disabled", true );
    }
}

function jokeInputs(){
	/*
	Returns input fields for joke-table
	*/

	var ji = '<table style="display:inline-block">'

	for ( var i in fixedLists.jokeCols){
		if ( i == 9 ){
			ji += '</table></td><td class="modal-td1"><table style="display:inline-block">'
		}
		if (fixedLists.jokeCols[i][1] == 'bool'){
			ji +=	'<tr><td colspan="2"><input type="checkbox" id="'+fixedLists.jokeCols[i][0]+'" name="' +
					fixedLists.jokeCols[i][0]+'" value="1" > '+fixedLists.jokeCols[i][0]+'</td></tr>';
		} else {
			ji += 	'<tr><td style="text-align:right">'+fixedLists.jokeCols[i][0]+'</td><td><textarea id="'+fixedLists.jokeCols[i][0]+'" name="' +
					fixedLists.jokeCols[i][0]+'" maxlength="1000" ></textarea></td></tr>';
		}
	}
	ji += '</table>'
	return ji
}

function outerJokeInputs(){
	/*
	Returns input fields for lm_type, ta_label and ns tables
	*/

	oi = '<table style="display:inline-block">';
	for ( var i in fixedLists.jokeRelatedSame ){
		oi += 	'<table style="display:inline-block">' +
						'<div class="modal-options-container"><b>'+fixedLists.jokeRelatedSame[i]+'</b><div id="' +
						fixedLists.jokeRelatedSame[i]+'-data"></div>' +
						'<button id="add-'+fixedLists.jokeRelatedSame[i]+'-input" class="modal-add-btn" >+</button> ' +
						'<button class="joke-new-value" >new value</button>' +
						'<div class="joke-new-value-container"><input type="text" placeholder="new value" >' +
						'<button class="joke-new-button-store" data-id="'+fixedLists.jokeRelatedSame[i]+'" >define</button></div>';
	}
	oi += '</table>';
	return oi
}

function jokeButtonActions(){
	/*
	Assign actions to the buttons in the joke-modal
	*/

	// Show input for new tag/value when [new value] button is clicked
	$('.joke-new-value').click(function() {
		$(this).next().slideToggle();
	})

	// Copy new tag/value to current selects
	$('.joke-new-button-store').click(function() {
		$(this).parent().slideUp();
		var id = $(this).attr('data-id');
		var value = $(this).prev().val()
		if ( id == 'ns' ){
			value = 'other_'+value;
		}
		if ( value != ''){
			availableTags[id].push( value );
			availableTags[id] = Array.from(new Set(availableTags[id]));
			availableTags[id].sort();
			$('.'+id+'-select').append('<option value="' + value + '">' + value +'</selected>');
		}
		$(this).prev().val('');
	})

	// Add new select inputs
	$( '#add-lm_type-input' ).click(function() {
  		$('#lm_type-data').append(
			'<table><tr><td><select class="lm_type-select">'+getOptions('lm_type')+'</select></td><td>' +
			'<button onclick="$(this).parentsUntil(\'table\').remove();">-</button></td></tr></table>');
	});
	$( '#add-ta_label-input' ).click(function() {
  		$('#ta_label-data').append(
			'<table><tr><td><select class="ta_label-select">'+getOptions('ta_label')+'</select></td><td>' +
			'<button onclick="$(this).parentsUntil(\'table\').remove();">-</button></td></tr></table>');
	});
	$( '#add-ns-input' ).click(function() {
  		$('#ns-data').append(
			'<table><tr><td><select class="ns-select">'+getOptions('ns')+'</select></td><td>' +
			'<button onclick="$(this).parentsUntil(\'table\').remove();">-</button></td></tr></table>');
	});
	$( '#add-versification_mechanism-input' ).click(function() {
  		$('#versification_mechanism-data').append(
			'<table><tr><td><select class="versification_mechanism-select">'+getOptions('versification_mechanism')+'</select></td><td>' +
			'<button onclick="$(this).parentsUntil(\'table\').remove();">-</button></td></tr></table>');
	});

	// Submit the data to database
	$( "#submit-joke-btn" ).click(function() {
		checkCommitJoke();
	});
}

function checkCommitJoke(){
	/*
	Check whether intended commit to oke-table + lm_type, ta_label & ns is valid
	*/

	var preventCommit = false;

	// Check if modal contains fixed-tags selected multiple times
	types = ['lm_type', 'ta_label', 'ns', 'versification_mechanism']
	for ( var i in types ){
		selectedTagsList = [];
		selectedTagsDict = {};
		$( "."+types[i]+'-select' ).each(function() {
			selectedTagsList.push( $( this ).val() );
			selectedTagsDict[ $( this ).val() ] = 1;
		});
		if ( selectedTagsList.length > Object.keys(selectedTagsDict).length ) {

			popupOverScreenShow(
				'<b>INVALID COMMIT</b><p> You\'re trying to insert ' +
				'single value multiple times into ' + types[i] + '<p><button onclick="popupOverScreenHide();">OK</button>'
			);

			//alert('INVALID COMMIT: You\'re trying to insert single value multiple times into ' + types[i]);
			preventCommit = true;
			return;
		}
	}

	// Check if this range haven't been annotated already
	if (!editingExistingTags){
		rangeKey = 	selectedWordRange['min'] + '_' + selectedWordRange['max']
		if ( rangeKey in rireTags ){
			popupOverScreenShow(
				'<b>INVALID COMMIT</b><p> This passage already has joke annotated' +
				'<p><button onclick="popupOverScreenHide();">OK</button>'
			);
			//alert('INVALID COMMIT: This passage already annotated');
			preventCommit = true;
			return;
		}
	}

	// Commit to DB
	if (! preventCommit ){
		commitJoke();
	}
}

function commitJoke(){
	/*
	Commit to joke-table + lm_type, ta_label & ns
	*/

    var jokeKey = selectedWordRange['min'] + '_' + selectedWordRange['max'];

	// Get poem id and word ranges
	var commitObject = {
		loc_start: 	selectedWordRange['min'],
		loc_end: 	selectedWordRange['max'],
		lm_type:	[],
		ta_label:	[],
		ns:			[],
        jabline:    {},
        punchline:  {},
		versification_mechanism: [],
	};

	// Get values input values for joke tables
	for (var i in fixedLists.jokeCols){
		if ( fixedLists.jokeCols[i][1] == 'bool' ){
			if ( $( '#' + fixedLists.jokeCols[i][0] ).is(":checked") ){
				commitObject[ fixedLists.jokeCols[i][0] ] = 1;
			} else {
				commitObject[ fixedLists.jokeCols[i][0] ] = 0;
			}
		} else {
			commitObject[ fixedLists.jokeCols[i][0] ] = $( '#' + fixedLists.jokeCols[i][0] ).val();
		}
	}

	// Get values for related tables
	for ( var i in fixedLists.jokeRelatedSame){
		$('.'+fixedLists.jokeRelatedSame[i]+'-select').each( function() {
			commitObject[ fixedLists.jokeRelatedSame[i] ].push($(this).val());
		});
	}

    // Save joke, close modal & reload all annotations
    rireTags[jokeKey] = commitObject;
    showAnnotation();
}

function showAnnotation(){
    /*
    Show joke/jabline/punchline annotation
    */

    deselectAll();
    $('.tagBox, .punchlineBox, .jablineBox').remove();
    $('#modal').hide();
    popupOverScreenHide();
    $('.el-w').css('background', 'inherit')
    // Show boxes with rire/xline tags
    for ( var wIdRange in rireTags ){
        var [wId1, wId2] = wIdRange.split('_');
        tagBoxes(wId1, wId2);	
        for ( var wIdRange2 in rireTags[wIdRange]['jabline'] ){
            var [wId1, wId2] = wIdRange2.split('_');
            xlineBoxes(wId1, wId2, 'jabline');	
        }
        for ( var wIdRange2 in rireTags[wIdRange]['punchline'] ){
            var [wId1, wId2] = wIdRange2.split('_');
            xlineBoxes(wId1, wId2, 'punchline');	
        }
    }
}

function tagBoxes(wId1, wId2) {
	/*
	Plot tag boxes
	wId1   = id of first word of tagged passage
	wId2   = id of last word of tagged passage
	*/

	// Iterate over words in given range
	for ( var wId = parseInt(wId1); wId <= parseInt(wId2); wId++ ){
		// Place tag box under it
		var tagBox = 	'<div class="tagBox" data-tag-box-id="'+ wId1 + '_' + wId2 +
						'" style="background-color:' + colors.joke +
						'" data-col="' + colors.joke + '"></div>'
		$('.el-w[data-id='+wId+']').append(tagBox);
	}
}

function xlineBoxes(wId1, wId2, table) {
	/*
	Plot xline boxes
	wId1   = id of first word of tagged passage
	wId2   = id of last word of tagged passage
	*/

	// Iterate over words in given range
	for ( var wId = parseInt(wId1); wId <= parseInt(wId2); wId++ ){
		// Place tag box under it
		var xlineBox = 	'<div class="'+table+'Box" data-'+table+'-box-id="'+ wId1 + '_' + wId2 +
						'" style="background-color:' + colors[table] +
						'" data-col="' + colors[table] + '"></div>'
		$('.el-w[data-id='+wId+']').append(xlineBox);
	}
}

function popupOverScreenShow(content){
	/*
	Show popup with content
	*/
	$("#popup-over-screen-content").html('<center>'+content+'</center>');
	$("#popup-over-screen").fadeIn();
}


function popupOverScreenHide(){
	/*
	Hide popup with content
	*/
	$("#popup-over-screen-content").html('');
	$("#popup-over-screen").fadeOut();
}

function tagBoxTrigger(id, allowEdits) {
	/*
	Handle tagBox clicking
	*/
	editingExistingTags = true;
	// Select all tag-box-elements having the same data-tag-box-id as current selection
	tagBox = $('div[data-tag-box-id=' + id + ']');

	// If tag-box already selected
	if ( $( tagBox ).css("backgroundColor") == 'rgb(0, 0, 0)' ){
		// Use original background color for all tag-boxes and words in document
		deselectAll();
	// If tag-box not selected yet
	} else {
		// Deselect all tag-boxes and words and hide modal
		deselectAll();
		// Store range to selection
		selectedWordRange = {'min': parseInt(id.split('_')[0]), 'max': parseInt(id.split('_')[1])};
		// Set selected tag-box background to black
		$( tagBox ).css('backgroundColor', 'rgb(0, 0, 0)');
		// Show joke modal and fill it with data from database
		brandNewModal(id.split('_')[0]);
		jokeModal(allowEdits);
		fillJokeModal(id, allowEdits);
	}
}

function xlineBoxTrigger(id, table, allowEdits) {
	/*
	Handle tagBox clicking
	*/
	editingExistingTags = true;
	// Select all xline-box-elements having the same data-tag-box-id as current selection
	xlineBox = $('div[data-'+table+'-box-id=' + id + ']');

	// If xline-box already selected
	if ( $( xlineBox ).css("backgroundColor") == 'rgb(0, 0, 0)' ){
		// Use original background color for all xline-boxes and words in document
		deselectAll();
	// If xline-box not selected yet
	} else {
		// Deselect all tag-boxes and words and hide modal
		deselectAll();
		// Store range to selection
		selectedWordRange = {'min': parseInt(id.split('_')[0]), 'max': parseInt(id.split('_')[1])};
		// Set selected tag-box background to black
		$( xlineBox ).css('backgroundColor', 'rgb(0, 0, 0)');
		// Show joke modal and fill it with data from database
		brandNewModal(id.split('_')[0]);
		lineModal(table, allowEdits);
		fillLineModal(id, table, allowEdits);
	}
}

function fillJokeModal(rangeId, allowEdits){
	/*
	Fill joke modal with data from db when editing already existing data
	*/
	// Iterate over joke db columns
	for (var i in fixedLists['jokeCols']){
		// If col is boolean and set to 1 > check the relevant checkbox
		if ( fixedLists['jokeCols'][i][1] == 'bool' ){
			if ( rireTags[rangeId][ fixedLists['jokeCols'][i][0] ] == 1 ){
				$( '#' + fixedLists['jokeCols'][i][0] ).prop("checked", true);
			}
		// Otherwise fill the textarea with a text
		} else {
			$( '#' + fixedLists['jokeCols'][i][0] ).html( rireTags[rangeId][ fixedLists['jokeCols'][i][0] ] );
		}
	}

	// Get values for related tables
	for ( var i in fixedLists['jokeRelatedSame']){
		var table = fixedLists['jokeRelatedSame'][i];
		for ( var j in rireTags[rangeId][table] ){
			var val = rireTags[rangeId][table][j];
	  		$('#'+table+'-data').append(
				'<table><tr><td><select class="'+table+'-select">' + getOptions( table, val ) + '</select></td><td>' +
				'<button onclick="$(this).parentsUntil(\'table\').remove();">-</button></td></tr></table>'
			);
		}
	}

	// Append delete button
    if ( allowEdits === true) {
        $('#modal').append(
            '<div id="delete-record-container"><button id="delete-record-btn">DELETE JOKE</button></div>'
        );
        $( "#delete-record-btn" ).click(function() {
            popupOverScreenShow(
                'Are you sure you wanna delete the joke including all jablines and punchlines?' +
                '<p><button onclick="deleteJoke();">YES</button> <button onclick="popupOverScreenHide();">NO</button>'
            );
        });
    }
}

function deleteJoke(){
	/*
	Delete joke
	*/

    var jokeKey = selectedWordRange['min'] + '_' + selectedWordRange['max'];
    delete rireTags[jokeKey];
    showAnnotation();
}

function lineModal(table, allowEdits){
	/*
	Show modal for joke-table
	*/

	// Modal closer
	$('#modal').html('<div id="modal-closer" onclick="deselectAll()">×</div>');

	// Table marker
	$('#modal').append('<div id="tableMarker" >■■■</div>');
	$('#tableMarker').css('color', colors[table]);

	// Text area
    if ( allowEdits === true) {
        $('#modal').append('<textarea id="line-comment-input" maxlength="1000" placeholder="comment"></textarea>');
    } else {
        $('#modal').append('<textarea id="line-comment-input" maxlength="1000" placeholder="comment" disabled></textarea>');
    }
	// Submit  button
    if ( allowEdits === true) {
    	$('#modal').append('<p><center><button onclick="checkCommitLine(\''+table+'\')">SAVE</button></center>');
    }
}


function fillLineModal(rangeId, table, allowEdits){
	/*
	Fill joke modal with data from db when editing already existing data
	*/

	for ( var jokeRangeId in rireTags ){
		if ( rangeId in rireTags[jokeRangeId][table] ){
			$('#line-comment-input').val( rireTags[jokeRangeId][table][rangeId]['comment']);
		}
	}

	// Append delete button
    if (allowEdits === true) {
        $('#modal').append( '<div id="delete-record-container"><button id="delete-record-btn" >DELETE ' + table.toUpperCase() + '</button></div>');
        $( "#delete-record-btn" ).click(function() {
            popupOverScreenShow(
                'Are you sure you wanna delete the ' + table +
                '<p><button onclick="deleteLine(\''+table+'\');">YES</button> <button onclick="popupOverScreenHide()">NO</button>'
            );
        });
    }
}

function checkCommitLine(table){
	/*
	Check whether intended commit to jabline / punchline is valid
	*/

	var preventCommit = false;

	// Check to how many jokes the jabline/punchline contributes
	var relevantJokes = [];
	for ( var jokeRange in rireTags){
		var jokeStart = parseInt(jokeRange.split("_")[0]);
		var jokeEnd = parseInt(jokeRange.split("_")[1]);
		if ( selectedWordRange['min'] >= jokeStart && selectedWordRange['max'] <= jokeEnd ){
			relevantJokes.push(jokeRange);
		}
	}

	// Jabline / punchline does not fall within range of any joke
	if ( relevantJokes.length == 0 ){
		popupOverScreenShow('<b>INVALID COMMIT</b><p> You\'re trying to insert ' + table + ' outside of the joke' +
			'<p><button onclick="popupOverScreenHide()">OK</button>');
		//alert('INVALID COMMIT: You\'re trying to insert ' + table + ' outside of the joke ');
		preventCommit = true;
		return;
	}

	// Jabline / punchline already defined on this range
	if (!editingExistingTags){
		rangeKey = selectedWordRange['min'] + '_' + selectedWordRange['max']
		for ( var i in relevantJokes ){
			if ( rangeKey in rireTags[relevantJokes[i]][table] ){
				popupOverScreenShow('<b>INVALID COMMIT</b><p>This passage already annotated with ' + table +
					'<p><button onclick="popupOverScreenHide()">OK</button>');
				//alert('INVALID COMMIT: This passage already annotated with ' + table);
				preventCommit = true;
				return;
			}
		}
	}

	// Empty comment
	if ( $('#line-comment-input').val().trim() == '' ){
		popupOverScreenShow('<b>INVALID COMMIT</b><p>You\'re trying to insert an empty comment' +
		'<p><button onclick="popupOverScreenHide()">OK</button>');
		preventCommit = true;
		return;
	}

	// Jabline / punchline contributes to more than one joke
	if ( relevantJokes.length > 1 ){
		commitLineSelectJoke(table, relevantJokes);
		preventCommit = true;
		return;
	}

	// Commit to DB
	if (! preventCommit ){
		commitLine(table, relevantJokes[0]);
	}
}

function commitLineSelectJoke(table, relevantJokes){
	/*
	Popup to pick up joke under which jabline / punchline will be asigned
	*/

	var dialog = 	'This ' + table + ' fits into multiple jokes. Please select to which it should be assigned.'
	for ( var i in relevantJokes ){
		dialog += '<p><button onclick="commitLine(\''+table+'\',\''+relevantJokes[i]+'\')">' + rireTags[relevantJokes[i]]['context'] + '</button>';
	}
	dialog += '<p><button onclick="popupOverScreenHide()">CANCEL</button></div>';
	popupOverScreenShow(dialog);
}

function commitLine(table, joke_key){
	/*
	Commit to jabline / punchline
	*/

    var lineKey = selectedWordRange['min'] + '_' + selectedWordRange['max'];
	var commitObject = {
		loc_start: 	selectedWordRange['min'],
		loc_end: 	selectedWordRange['max'],
		comment:	$('#line-comment-input').val(),
	};
    rireTags[joke_key][table][lineKey] = commitObject;
    showAnnotation();
    console.log(rireTags);
}

function deleteLine(table){
	/*
	Delete punchline / jabline 
	*/

    var key = selectedWordRange['min'] + '_' + selectedWordRange['max'];
    for (jokeKey in rireTags){
        for (lineKey in rireTags[jokeKey][table]){
            if ( lineKey == key){
                delete rireTags[jokeKey][table][lineKey];
            }
        }
    }
    showAnnotation();
}

function getOptions(type, selectedItem=null){
	/*
	Returns available tags for a given type formatted as a html string containing select-options
	*/

	options = '';
	for (var j in availableTags[type]){
		console.log(availableTags[type][j], selectedItem)
		if ( selectedItem == availableTags[type][j] ){
			options += '<option value="'+availableTags[type][j]+'" selected="selected">'+availableTags[type][j]+'</option>';
		} else {
			options += '<option value="'+availableTags[type][j]+'">'+availableTags[type][j]+'</option>';
		}
	}
	return options;
}

/* ==================== IMPORTING ======================================= */

function importPlain(event){
    /*
    Import plaintext file
    */
    const file = event.target.files[0]; 
    if (file) { 
        const reader = new FileReader(); 
        reader.onload = function(e) { 
            try { 
                $('#p-text').val(e.target.result); 
                if (e.target.result.length > 0){
                    $('#btn-tokenize').show();
                }
            } catch (error) { 
                popupOverScreenShow('<b>Error reading file</b><p><button onclick="popupOverScreenHide()">OK</button>');
            } 
        }; 
        reader.readAsText(file); 
    } 
}

function importJSON(event){
    /*
    Import data from JSON
    */
    const file = event.target.files[0]; 
    if (file) { 
        const reader = new FileReader(); 
        reader.onload = function(e) { 
            try { 
                const jsonData = JSON.parse(e.target.result); 
                if ('title' in jsonData && 'author' in jsonData && 'model' in jsonData && 'tokens' in jsonData && 'annotation' in jsonData){
                    showImportedData(jsonData.title, jsonData.author, jsonData.model, jsonData.tokens, jsonData.annotation);
                } else {
                    popupOverScreenShow('<b>Error parsing file</b><p><button onclick="popupOverScreenHide()">OK</button>');
                }
            } catch (error) { 
				console.error(error);
                popupOverScreenShow('<b>Error parsing file</b><p><button onclick="popupOverScreenHide()">OK</button>');
            } 
        }; 
        reader.readAsText(file); 
    } 
}

function showImportedData(title_, author_, model_, tokens_, annotation_){
    /*
    Show data imported from JSON or XML file
    */
    $('#p-title').val(title_);
    $('#p-author').val(author_);
    $('#p-model').find(":selected").removeAttr("selected");
    $('#p-model').append($('<option>', {text: model_, selected: true}));
    tokens = tokens_;
    rireTags = annotation_;
	for ( var i in fixedLists['jokeRelatedSame']){
		var table = fixedLists['jokeRelatedSame'][i];
		for (rangeId in rireTags){
			for ( var j in rireTags[rangeId][table] ){
				var val = rireTags[rangeId][table][j];
				if (! (availableTags[table].includes(val)) ){
					availableTags[table].push(val);
					availableTags[table].sort();
				}
			}
		}
	}	
    renderTokenizedText(tokens);
    showAnnotation();    
}


/* ==================== EXPORTING ======================================= */

function exportJSON(){
    /*
    Export data to JSON
    */
    let obj = {
        title      : $('#p-title').val(),
        author     : $('#p-author').val(),
        model      : $('#p-model').find(":selected").text(),
        tokens     : tokens,
        annotation : rireTags,
    }
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json',});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jigs_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

/* ==================== STATS ======================================= */

function computeStats(){
	/*
	Compute stats on annotated text
	*/
	$('#stats-content').html(
		'<table class="stat-tab"><tr><td>Number of JOLIs:</td><td>' + Object.keys(rireTags).length + '</td></tr>' +
		'<tr><td>Number of tokens:</td><td>' + tokens.length + '</td></tr></table>'
	);
	$('#stats-content').append('<div id="chart1" class="chart-bin"></div>');
	so_chart();
	$('#stats-content').append('<div id="chart2" class="chart-bin"></div>');
	type_chart('lm_type', 'chart2', 'LM types');
	$('#stats-content').append('<div id="chart3" class="chart-bin"></div>');
	type_chart('ta_label', 'chart3', 'Target type');
	$('#stats-content').append('<div id="chart4" class="chart-bin"></div>');
	type_chart('ns', 'chart4', 'NS type');
	$('#stats-content').append('<div id="chart5" class="chart-bin"></div>');
	length_chart();

	console.log(rireTags)
}

function so_chart(){
	/*
	Build SO-chart
	*/
	cats = [ 
		"so_actual_non", "so_normal_abnormal", "so_possible_impossible", "so_good_bad", "so_life_death", 
      	"so_obscenity", "so_money", "so_high_low_stature", "so_human_non"
	];
	vals = Array(cats.length).fill(0)
	for (var span in rireTags){
		for (var i in cats){
			if (rireTags[span][cats[i]] == 1){
				vals[i] += 1;
			}
		}  
	}
	highcharts_col(vals, cats, 'chart1', 'SO types');
}

function type_chart(t, target, title){
	/*
	Build LM-chart, Target chart, 
	*/
	cats = availableTags[t];
	vals = Array(cats.length).fill(0)
	for (var span in rireTags){
		for (lm of rireTags[span][t]){
			var i = cats.indexOf(lm);
			if (i === -1) {
				cats.append(lm)
				vals[lm.length-1] += 1
			} else {
				vals[i] += 1;
			}
		}
	}
	highcharts_col(vals, cats, target, title);
}

function length_chart(){
	/*
	Build histogram of JOLI lengths
	*/
	vals = [];
	for (var span in rireTags){
		var ids = span.split('_');
		var length = parseInt(ids[1]) - parseInt(ids[0]);
		vals.push(length);
	}
	highcharts_histo(vals, 'chart5', 'JOLI lengths');
}

function highcharts_col(vals, cats, target, title){
	/*
	General function to provide column chart
	*/
	Highcharts.chart(target, {
		chart: {type: 'column'},
		title: {text: title},
		exporting: {enabled: true},
		credits: {enabled: false},
		xAxis: {
			categories: cats,
		},
		yAxis: { min: 0, title: {text: ''}},
		series: [
			{
				name: '',
				data: vals,
			},
		]
	});
}

function highcharts_histo(vals, target, title){
	/*
	General function to provide histogram
	*/
	Highcharts.chart(target, {
		chart: {type: 'histogram'},
		title: {text: title},
		exporting: {enabled: true},
		credits: {enabled: false},
		yAxis: { min: 0, title: {text: ''}},
		series: [
			{
				name: '',
				data: vals,
			},
		]
	});
}


/* ==================== BINDINGS ======================================= */

$( document ).ready(function() {
    
    $("body").on('input', '#p-text',  function() {
        // Only show Tokenize-tagging button if textarea is not empty
        if ($('#p-text').val().trim().length > 0){
            $('#btn-tokenize').show();
        } else {
            $('#btn-tokenize').hide();
        }
    });

    $("body").on('click', '#btn-tokenize',  function() {
        // Tokenization button
        t = preprocess_text();
        tokenize(t);
    });

    $("body").on('click', '#btn-plain',  function() {
        // Import plaintext
        $('#input-plain').click();
    }); 
    $("body").on('change', '#input-plain',  function(event) {
        importPlain(event);
    }); 

    $("body").on('click', '#btn-json',  function() {
        // Import JSON
        $('#input-json').click();
    }); 
    $("body").on('change', '#input-json',  function(event) {
        importJSON(event);
    });     

    $("body").on('click', '#btn-json-out',  function() {
        // Export JSON
        exportJSON();
    });    

    $("body").on('click', '.el-w',  function() {
        // Word clicked
        wordTrigger($(this).attr('data-id'));
    });

    $("body").on('click', ".tagBox", function() {
        // Tag box (joke)
        var tagBoxId = $(this).attr('data-tag-box-id');
        tagBoxTrigger(tagBoxId, true);
        return false;
    });
    $("body").on('click', ".jablineBox", function() {
        // Jabline box
        var tagBoxId = $(this).attr('data-jabline-box-id');
        xlineBoxTrigger(tagBoxId, 'jabline', true);
        return false;
    });
    $("body").on('click',".punchlineBox", function() {
        // Punchline box
        var tagBoxId = $(this).attr('data-punchline-box-id');
        xlineBoxTrigger(tagBoxId, 'punchline', true);
        return false;
    });

    $("body").on('click', '#btn-restart',  function() {
        // New document
        popupOverScreenShow(
            '<b>Are you sure you want to start processing another document?</b><p>All unsaved changes will be lost<p>' + 
            '<button onclick="location.reload()">YES</button> <button onclick="popupOverScreenHide()">NO</button>'
        );
    });    

    $("body").on('click', '#btn-stats',  function() {
        // Show stats
		computeStats();
        $('#stats-bin').show();
    }); 	
    $("body").on('click', '#btn-closer',  function() {
        // Hide stats
		$('#stats-content').html('');
        $('#stats-bin').hide();
    }); 	

});

