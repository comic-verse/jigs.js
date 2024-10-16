# JIGS.js (Joke-like Incongruity Gathering System)

[![CC BY-SA 4.0][cc-by-sa-shield]][cc-by-sa]

[cc-by-sa]: http://creativecommons.org/licenses/by-sa/4.0/
[cc-by-sa-image]: https://licensebuttons.net/l/by-sa/4.0/88x31.png
[cc-by-sa-shield]: https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg

JIGS.js is a client-side interface for Joke-like entity annotation. Its implementation is quite straightforward. Just include ``jigs.js`` and ``jigs.css`` into your page head along with ``jQuery`` and ``jQuery UI``:

```html
<head>
	<script src="js/jquery-3.7.1.min.js"></script>
	<script src="js/jquery-ui.min.js"></script>
	<script src="js/jigs.js"></script>
	<link rel="stylesheet" href="css/jquery-ui.css">
	<link rel="stylesheet" href="css/jigs.css">
</head>
```

To include JIGS.js interface simply create a ``<div>`` and pass its ``id`` to ``startJigs()`` function:

```html
<div id="jigs-bin"></div>
<script>
  startJigs('jigs-bin');
</script>
```

Optionally you may pass the name of a language model as a second argument. This model is then going to be set as default:

```JavaScript
startJigs('jigs-bin', 'french-gsd');
```

For the list of available models see [https://ufal.mff.cuni.cz/udpipe/2/models].
