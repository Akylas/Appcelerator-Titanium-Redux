var fs = require('fs'),
	path = require('path'),
	cp = require('child_process'),
	exec = cp.exec,
	spawn = cp.spawn;

exports.cliVersion = '>=3.X';

function removefilesfromregex(regex, currentDirectory, logger) {
	if (!fs.lstatSync(currentDirectory).isDirectory()) {
		return;
	}

	fs.readdirSync(currentDirectory).forEach(function(file) {
		var path = currentDirectory + '/' + file;
		if (fs.lstatSync(path).isDirectory())
			removefilesfromregex(regex, path, logger);
		else if (regex.test(path))
			fs.unlink(path);
	});
}

function findRJSS(currentDirectory, logger) {
	if (!fs.lstatSync(currentDirectory).isDirectory()) {
		return;
	}
	fs.readdirSync(currentDirectory).forEach(function(file) {
		var path = currentDirectory + '/' + file;
		if (fs.lstatSync(path).isDirectory())
			findRJSS(path, logger);
		else if (/.rjss$/.test(path))
			compileRJSS(path, logger)
	});
}

function compileRJSS(path, logger) {
	logger.debug('compileRJSS: %s', path.cyan);
	var rjss = fs.readFileSync(path, 'utf8').replace(/[\r\t\n]/g, ' ');
	var result = '';
	var braceDepth = 0;
	var inComment = false;
	var inSelector = false;
	var inAttributeBrace = false;
	var inBracket = false;
	var canStartSelector = true;
	var canBeAttributeBrace = false;
	var inIfStatement = false;
	var inOrientation = false;
	var inVariable = false;

	for (var i = 0, j = rjss.length; i < j; i++) {
		var currentChar = rjss[i];
		if (inComment === true) {
			if (currentChar === '/' && rjss[i - 1] === '*')
				inComment = false;
			continue;
		}

		function space() {
			if (inBracket === true)
				result += currentChar;
		}

		function slash() {
			inComment = (rjss[i + 1] === '*');
			if (inComment === true)
				result += '';
			else
				result += currentChar;
		}

		function leftBracket() {
			if (braceDepth > 0)
				result += currentChar;
			else {
				canStartSelector = false;
				inIfStatement = true;
				result += 'if (';
			}
		}

		function bracket() {
			inBracket = (inBracket === false);
			result += currentChar;
		}

		function equals() {
			if (inIfStatement && rjss[i - 1] !== '!' && rjss[i - 1] !== '<' && rjss[i - 1] !== '>')
				result += '==';
			else 
				result += currentChar;
		}

		function rightBracket() {
			if (braceDepth > 0)
				result += currentChar;
			else {
				canStartSelector = true;
				result += ')';
				inIfStatement = true;
				canBeAttributeBrace = true;
			}
		}

		function leftBlock() {
			if (canBeAttributeBrace === true) {
				canBeAttributeBrace = false;
				inAttributeBrace = true;
			} else {
				if (inSelector === true) {
					inSelector = false;
					result += '",';
				}
				braceDepth += 1;
			}
			result += currentChar;
		}

		function rightBlock() {
			braceDepth -= 1;
			result += currentChar;
			switch (braceDepth) {
				case 0:
					if (rjss[i + 1] !== '(') {
						result += ');';
						canStartSelector = true;
					} else {
						inOrientation = true;
						result += ',';
					}
					break;
				case -1:
					inAttributeBrace = false;
					braceDepth = 0;
					break;
			}
		}

		function defaultCase() {
			canBeAttributeBrace = false;
			if (braceDepth === 0 && canStartSelector === true) {
				canStartSelector = false;
				inSelector = true;
				result += '\nredux.fn.setDefault("';
			}
			result += currentChar;
		}

		function leftParenthesis() {
			if (inOrientation === false)
				defaultCase();
		}

		function rightParenthesis() {
			if (inOrientation === true) {
				result += ');';
				inOrientation = false;
				canStartSelector = true;
			} else {
				result += currentChar;
			}
		}

		function dollar() {
			if (braceDepth == 0 && canStartSelector) {
				canStartSelector = false;
				inVariable = true;
				result += 'this.$';
			} else {
				result += currentChar;
			}
		}

		function semicolon() {
			if (inVariable) {
				canStartSelector = true;
				inVariable = false;
			}
			result += currentChar;
		}

		switch (currentChar) {
			case '$':
				dollar();
				break;
			case ';':
				semicolon();
				break;
			case ' ':
				space();
				break;
			case '/':
				slash();
				break;
			case '\'':
				bracket();
				break;
			case '"':
				bracket();
				break;
			case '[':
				leftBracket();
				break;
			case '=':
				equals();
				break;
			case ']':
				rightBracket();
				break;
			case '{':
				leftBlock();
				break;
			case '}':
				rightBlock();
				break;
			case '(':
				leftParenthesis();
				break;
			case '(':
				rightParenthesis();
				break;
			default:
				defaultCase();
		}
	}

	fs.writeFileSync((path + '.compiled.js'), result);
}

exports.init = function(logger, config, cli, appc) {
	var needsToRun = true;

	var path = appc.fs.resolvePath(cli.argv['project-dir'], "Resources");

	cli.addHook('build.pre.compile', function(data, finished) {

		removefilesfromregex(/.rjss.compiled.js$/, path, logger);
		needsToRun = ((data.deployType === 'production') || (data.tiapp.properties.hasOwnProperty('ti.android.compilejs') && data.tiapp.properties['ti.android.compilejs'].value === true && data.deployType !== 'development'));
		if (needsToRun === true) {
			logger.info('compiling RJSS files');
			var regex = data.config.cli.ignoreFiles;
			regex = regex.replace(')$', '|.rjss.compiled.js)$');
			data.config.cli.ignoreFiles = regex;
			removefilesfromregex(/.rjss.compiled.js$/, path, logger);
			findRJSS(path, logger);
		}
		finished();
	});

	cli.addHook('build.post.compile', function(data, finished) {
		//we need to remove .rjss from assets directory
		if (needsToRun === true) {
			removefilesfromregex(/.rjss.compiled.js$/, path, logger);
		}
		finished();
	});

	cli.addHook('build.finalize', function(data, finished) {
		finished();
	});
};