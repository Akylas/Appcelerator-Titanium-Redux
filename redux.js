/*!
* Appcelerator Redux v9.1.1 by Dawson Toth
* http://tothsolutions.com/
*
* NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
*/

/**
 * Provide a central context for dealing with elements and configuring redux.
 */
var redux = function (selector) {
    return new redux.fn.init(selector);
};

inject(module.exports = redux);

function inject(context) {
    !this.Titanium && context.Titanium && (Titanium = context.Titanium);
    !this.Ti && context.Ti && (Ti = context.Ti);

    /**
     * Create shorthand for commonly used functions.
     */
    context.debug = context.debug || function(message) { Ti.API.debug(message); };
    context.info = context.info || function(message) { Ti.API.info(message); };
    context.error = context.error || function(message) { Ti.API.error(message); };
    context.warn = context.warn || function(message) { Ti.API.warn(message); };
    context.log = context.log || function(level, message) { Ti.API.log(level, message); };
    context.currentWindow = context.currentWindow || function() { return Ti.UI.currentWindow; };
    context.currentTab = context.currentTab || function() { return Ti.UI.currentTab; };
    context.win = context.win || context.currentWindow;
    context.tab = context.tab || context.currentTab;

    /**
     * Tracks and stores various data for redux, like events, elements, and included files.
     */
    redux.data = {
        events: [
            'beforeload', 'blur', 'change', 'click', 'close', 'complete', 'dblclick', 'delete', 'doubletap',
            'error', 'focus', 'load', 'move', 'open', 'return', 'scroll', 'scrollEnd', 'selected', 'singletap',
            'swipe', 'touchcancel', 'touchend', 'touchmove', 'touchstart', 'twofingertap', 'itemclick'
        ],
        types: {
            Contacts: [
                'Group', 'Person'
            ],
            Facebook: [
                'LoginButton'
            ],
            Filesystem: [
                'TempDirectory', 'TempFile'
            ],
            Media: [
                'AudioPlayer', 'AudioRecorder', 'Item', 'MusicPlayer', 'Sound', 'VideoPlayer'
            ],
            Network: [
                'BonjourBrowser', 'BonjourService', 'HTTPClient', 'TCPSocket'
            ],
            Platform: [
                'UUID'
            ],
            Stream: [
                'Stream'
            ],
            UI: [
                '2DMatrix', '3DMatrix', 'ActivityIndicator', 'AlertDialog', 'Animation', 'Button', 'ButtonBar',
                'CoverFlowView', 'DashboardItem', 'DashboardView', 'EmailDialog', 'ImageView', 'Label', 'MaskedImage',
                'Notification', 'OptionDialog', 'Picker', 'PickerColumn', 'PickerRow', 'ProgressBar', 'ScrollView',
                'ScrollableView', 'SearchBar', 'Slider', 'Switch', 'Tab', 'TabGroup', 'TabbedBar', 'TableView',
                'TableViewRow', 'TableViewSection', 'TextArea', 'TextField', 'Toolbar', 'View', 'WebView', 'Window',
                'ListView', 'ListSection', 'ListItem', 'NavigationWindow', 'SlideMenu'
            ]
        },
        defaults: {
            byID: {},
            byRclass: {},
            byType: {}
        },
        idCounter: 0
    };

    function isObject(obj) {
        // Check for null
        return !!obj && obj != null && (typeof obj === 'object' && (!Ti.Android || obj.toString() == '[object Object]'));
    };

    function isArray(obj) {
        // Check for null
        return !!obj && (obj instanceof Array);
    };

    function hasOwnProperty(obj, prop) {
        return !!obj && ((obj.hasOwnProperty && obj.hasOwnProperty(prop)) || (!obj.hasOwnProperty && obj[prop]));
    };

    function mergeObjects(target, source, newObjOverridesDefault) {
        var key, val, goDeep;
        if (target) {
            for (key in source) {
                if (!hasOwnProperty(source, key))
                    continue;
                val = source[key];
                // Deep merging.
                if (isArray(val)) {
                    target[key] = val.slice(0);
                } else if (isObject(val)) {
                    if (!target[key])
                        target[key] = {};
                    mergeObjects(target[key], val, newObjOverridesDefault);
                } else if ((typeof target[key] === 'undefined') || (newObjOverridesDefault === true)) {
                    target[key] = val;
                }
            }
        }
        return target;
    };
    /**
     * The core redux functions.
     */
    redux.fn = redux.prototype = {
        /**
         * Returns the objects that match your selector, or the root redux object if you did not provide a selector. Note that only
         * objects created by redux constructors can be selected (ex use new Label() instead of Ti.UI.createLabel()).
         * @param {Object} selector
         */
        init: function (selector) {
            if (!selector) {
                return this;
            }
            this.selector = selector;
            // object
            if (typeof selector == 'object') {
                this.context = [this[0] = selector];
                this.length = 1;
                return this;
            }
            throw 'Non-object selectors have been turned off in this version of redux for memory reasons.';
        },

        parseOrientationString:function(o) {
	        if (o === undefined)
	            return 'none';
	        if (o === Ti.UI.LANDSCAPE_RIGHT)
	            return Ti.UI.LANDSCAPE_LEFT;
	        if (o === Ti.UI.UPSIDE_PORTRAIT)
	            return Ti.UI.PORTRAIT;
	        return o;
	    },

        /**
         * Turns a string of RJSS into JavaScript that can be safely evaluated. RJSS is a way to customize JavaScript
         * objects quickly, and is primarily used to style your UI elements.
         *
         * @param {String} rjss The raw RJSS contents to parse into executable JavaScript
         * @returns {String} Executable JavaScript
         */
        parseRJSS: function(file) {

            var compiled = Ti.Filesystem.getFile(file + '.compiled.js');
            if (compiled.exists()) {
                return compiled.read() + '';
            }

            debug('parseRJSS ' + file);

            var rjss = (Ti.Filesystem.getFile(file).read() + '').replace(/[\r\t\n]/g, ' ');
            var result = '', braceDepth = 0;
            var inComment = false, inSelector = false, inAttributeBrace = false, inVariable = false, inIfStatement = false, inOrientation = false;
            var canStartSelector = true, canBeAttributeBrace;

            for (var i = 0, l = rjss.length; i < l; i++) {
            	var currentChar = rjss[i];
                if (inComment) {
                    if (currentChar == '/' && rjss[i - 1] == '*') {
                        inComment = false;
                    }
                    continue;
                }
                switch (currentChar) {
                    case '$':
                        if (braceDepth == 0 && canStartSelector) {
                            canStartSelector = false;
                            inVariable = true;
                            result += 'this.$';
                        } else {
                            result += currentChar;
                        }
                        break;
                    case ';':
                        if (inVariable) {
                            canStartSelector = true;
                            inVariable = false;
                        }
                        result += currentChar;
                        break;
                    case ' ':
                        result += currentChar;
                        break;
                    case '/':
                        inComment = rjss[i + 1] == '*';
                        result += inComment ? '' : '/';
                        break;
                    case '[':
                        if (braceDepth > 0) {
                            result += currentChar;
                        } else {
                            canStartSelector = false;
                            inIfStatement = true;
                            result += 'if (';
                        }
                        break;
                    case '=':
                        if (inIfStatement === true)
                            result += (rjss[i - 1] != '!' && rjss[i - 1] != '<' && rjss[i - 1] != '>') ? '==' : '=';
                        else 
                            result += currentChar;
                        break;
                    case ']':
                        if (braceDepth > 0) {
                            result += ']';
                        } else {
                            canStartSelector = true;
                            result += ')';
                            inIfStatement = false;
                            canBeAttributeBrace = true;
                        }
                        break;
                    case '{':
                        if (canBeAttributeBrace) {
                            canBeAttributeBrace = false;
                            inAttributeBrace = true;
                        } else {
                            if (inSelector) {
                                inSelector = false;
                                result += '",';
                            }
                            braceDepth += 1;
                        }
                        result += currentChar;
                        break;
                    case '}':
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
                        break;
                    case ')':
                        if (inOrientation === true) {
                            result += ');';
                            inOrientation = false;
                            canStartSelector = true;
                        } else {
                            result += currentChar;
                        }
                        break;
                    case '(':
                        if (inOrientation === true)
                            break;
                    default:
                        canBeAttributeBrace = false;
                        if (braceDepth == 0 && canStartSelector) {
                            canStartSelector = false;
                            inSelector = true;
                            result += '\nredux.fn.setDefault("';
                        }
                        result += currentChar;
                        break;
                }
            }
            return result;
        },
        
        /**
         * Includes and parses one or more RJSS files. Styles will be applied to any elements you create after calling this.
         * @param {Array} arguments One or more RJSS files to include and parse
         */
        includeRJSS: function () {
            for (var i = 0, l = arguments.length; i < l; i++) {
                var parsedRJSS = redux.fn.parseRJSS(arguments[i]);
                try {
                    (new Function(parsedRJSS)).call(context);
                } catch(e) {
                    context.error('RJSS "' + arguments[i] + '" has syntax errors:');

                    // Check each line for errors
                    var lines = parsedRJSS.split("\n");
                    for (var i2 = 0, l2 = lines.length; i2 < l2; i2++) {
                        try {
                            (new Function(lines[i2])).call(context);
                        } catch (e) {
                            context.error("line " + i2 + ": " + e);
                        }
                    }

                    e.message = 'RJSS Syntax ' + e.message;
                }
            }
        },
        /**
         * Returns true if the element is in the array.
         * @param {Object} element
         * @param {Object} array
         * @return {Boolean} true if the element is in the array
         */
        contains: function (element, array) {
            if (array.indexOf) {
                return array.indexOf(element) !== -1;
            }
            for (var i = 0, l = array.length; i < l; i++) {
                if (array[i] === element) {
                    return true;
                }
            }
            return false;
        },

         /**
         * Creates a clone of an object
         * @param {Object} original
         */
        clone: function clone(original) {
            return JSON.parse(JSON.stringify(original));
        },
        /**
         * Adds an event binder that can bind listen events or fire events, similar to how jQuery's events stack works.
         * @param {Object} event
         */
        addEventBinder: function (event) {
            redux.fn.init.prototype[event] = function () {
                var action;
                if (arguments.length == 0 || !(arguments[0] instanceof Function)) {
                    action = 'fireEvent';
                } else {
                    action = 'addEventListener';
                }
                for (var i = 0, l = this.context.length; i < l; i++) {
                    this.context[i][action](event, arguments[0]);
                }
                return this;
            };
        },
        /**
         * Set the default properties for any elements matched by the RJSS selector.
         * @param {Object} selector
         * @param {Object} defaults
         * @param {Object} orientation
         */
        setDefault: function(selector, defaults, orientation) {
            orientation = redux.fn.parseOrientationString(orientation);
            var selectors = selector.split(',');
            for (var i = 0, l = selectors.length; i < l; i++) {
                // remove spaces
                var cleanSelector = selectors[i].split(' ').join('');
                var target;
                switch (cleanSelector.charAt(0)) {
                    case '#':
                        // set by ID
                        target = redux.data.defaults.byID;
                        cleanSelector = cleanSelector.substring(1);
                        // remove the '#'
                        break;
                    case '.':
                        // set by rclass
                        target = redux.data.defaults.byRclass;
                        cleanSelector = cleanSelector.substring(1);
                        // remove the '.'
                        break;
                    default:
                        // set by element type
                        target = redux.data.defaults.byType;
                        break;
                }
                if (!target[cleanSelector])
                    target[cleanSelector] = {};
                var selector = target[cleanSelector];
                selector[orientation] = mergeObjects(selector[orientation] || {}, defaults, true);
            }
            return this;
        },
        /**
         * Takes in an object and applies any default styles necessary to it.
         * @param args
         */
        style: function(type, args, orientation, override) {
            args = args || {};
            orientation = redux.fn.parseOrientationString(orientation);
            // merge defaults by id
            if (args.rid && args.rid !== '') {
                var rids = args.rid.split(' ');
                for (var i = rids.length - 1; i >= 0; i--) {
                    var rid = rids[i];
                    if (redux.data.defaults.byID[rid])
                        args = mergeObjects(args, redux.data.defaults.byID[rid][orientation], override);
                };
            }
            // merge defaults by class name
            if (args.rclass && args.rclass !== '') {
                var classes = args.rclass.split(' ');
                for (var i = classes.length - 1; i >= 0; i--) {
                    var rclass = classes[i];
                    if (redux.data.defaults.byRclass[rclass])
                        args = mergeObjects(args, redux.data.defaults.byRclass[rclass][orientation], override);
                };
            }
            // merge defaults by type
            if (type && type !== '' && redux.data.defaults.byType[type])
                return mergeObjects(args, redux.data.defaults.byType[type][orientation], override);
            else
                return args;
        },
        /**
         * Applies the styles from the passed in arguments directly to the passed in object.
         * @param obj Any object or UI element; does not have to be created by redux.
         * @param type The type of the object (Label, ImageView, etc)
         * @param args The construction arguments, such as the rid or rclass
         * @param orientation the orientation
         * @param override should override if exists
         */
        applyStyle: function(obj, type, args, orientation, override) {
            override = override !== false;
            var styles = redux.fn.style(type, args, orientation, override);
            mergeObjects(obj, styles, override, override);
        },
        /**
         * Applies the styles from the passed in arguments directly to the passed in
         * object.
         * @param obj Any object or UI element; does not have to be created by redux.
         * @param type The type of the object (Label, ImageView, etc)
         * @param args The construction arguments, such as the id or rclass
         */
        applyOrientation: function(obj, orientation, args, override) {
            args = args || {};
            var type = obj.constructorName || '';
            args.rclass = args.rclass || (obj.rclass || undefined)
            args.id = args.id || (obj.id || undefined)
            var styles = redux.fn.style(type, args, orientation, override);
            mergeObjects(obj, styles, override, override);
        },
        /**
         * Adds a natural constructors for all the different things you can create with Ti, like Labels,
         * LoginButtons, HTTPClients, etc. Also allows you to add your own natural constructors.
         *
         * @param context The context to add this constructor to ("this" would be a good thing to pass in here)
         * @param parent The parent namespace (like Ti.UI)
         * @param type The type of the constructor (like Label or Button)
         * @param constructorName The desired constructor name; defaults to type. Generic styles will use this.
         */
        addNaturalConstructor: function (context, parent, type, constructorName) {
            constructorName = constructorName || type;
            context[constructorName] = function() {
                var _args = Array.prototype.slice.call(arguments);
                if (_args.length === 0)
                    _args = [{}];
                _args[0] = redux.fn.style(constructorName, _args[0]);
                // return created object with merged defaults by type
                var obj = parent['create' + type].apply(context, _args);
                // obj.constructorName = constructorName;
                // obj._id_ = redux.data.idCounter++;
                return obj;
            };
            /**
             * Shortcut to setting defaults by type. Will only apply to objects you create in
             * the future using redux's constructors.
             * @param {Object} args
             */
            context[constructorName].setDefault = function(args) {
                redux.fn.setDefault(constructorName, args);
            };
        },
        /**
         * Adds a natural constructors for all the different things you can create with Ti, like Labels,
         * LoginButtons, HTTPClients, etc.
         *
         * @param context The context to add this constructor to ("this" would be a good thing to pass in here)
         * @param namespace The namespace under Ti that the object will be created in (like UI, as in Ti.UI)
         * @param type The type of the constructor (like Label or Button)
         * @param constructorName The desired constructor name; defaults to type. Generic styles will use this.
         */
        addTitaniumNaturalConstructor: function (context, namespace, type, constructorName) {
            constructorName = constructorName || type;
            context[constructorName] = function(args) {
                args = redux.fn.style(constructorName, args);
                args.constructorName = constructorName;
                // return created object with merged defaults by type
                var obj = Ti[namespace]['create' + type](args);
                // obj.constructorName = constructorName;
                // obj._id_ = redux.data.idCounter++;
                return obj;
            };
            /**
             * Shortcut to setting defaults by type. Will only apply to objects you create in
             * the future using redux's constructors.
             * @param {Object} args
             */
            context[constructorName].setDefault = function(args) {
                redux.fn.setDefault(constructorName, args);
            };
        }
    };

    /**
     * Add shorthand events.
     */
    for (var i = 0, l = redux.data.events.length; i < l; i++) {
        redux.fn.addEventBinder(redux.data.events[i]);
    }
    
    /**
     * Add natural constructors and shortcuts to setting defaults by type.
     */
    for (var i3 in redux.data.types) {
        // iterate over type namespaces (UI, Network, Facebook, etc)
        if (redux.data.types.hasOwnProperty(i3)) {
            for (var j3 = 0, l3 = redux.data.types[i3].length; j3 < l3; j3++) {
                // iterate over types within parent namespace (Label, LoginButton, HTTPClient, etc)
                redux.fn.addTitaniumNaturalConstructor(context, i3, redux.data.types[i3][j3]);
            }
        }
    }

    /**
     * Expose the applyStyle function to selector based redux usages -- $(view).applyStyle() etc.
     * @param type
     * @param args
     */
    redux.fn.init.prototype.applyStyle = function(type, args) {
        for (var i = 0, l = this.length; i < l; i++) {
            redux.fn.applyStyle(this.context[i], type, args);
        }
        return this;
    };

    /**
     * Expose the applyOrientation function to selector based redux usages --
     * $(view).applyOrientation() etc.
     * @param type
     * @param args
     * @param override
     */
    redux.fn.init.prototype.applyOrientation = function(orientation, args, override) {
        for (var i = 0, l = this.length; i < l; i++) {
            redux.fn.applyOrientation(this.context[i], orientation, args, override);
        }
        return this;
    };

    /**
     * Expose the applyClass function to selector based redux usages --
     * $(view).applyOrientation() etc.
     * @param type
     * @param args
     * @param override
     */
    redux.fn.init.prototype.applyClass = function(rclass, args, orientation, override) {
        args = args || {};
        args.rclass = rclass;
        for (var i = 0, l = this.length; i < l; i++) {
            redux.fn.applyStyle(this.context[i], undefined, args, orientation, override);
        }
        return this;
    };

    /**
     * Expose the applyId function to selector based redux usages --
     * $(view).applyOrientation() etc.
     * @param type
     * @param args
     * @param override
     */
    redux.fn.init.prototype.applyId = function(id, args, orientation, override) {
        args = args || {};
        args.id = id;
        for (var i = 0, l = this.length; i < l; i++) {
            redux.fn.applyStyle(this.context[i], undefined, args, orientation, override);
        }
        return this;
    };

    /**
     * Adds multiple children to the selector. -- $(view).add(child1, child2, child3, etc)
     * @param args
     */
    redux.fn.init.prototype.add = function (args) {
        for (var j = 0; j < arguments.length; j++) {
            for (var i = 0, l = this.length; i < l; i++) {
                this.context[i].add(arguments[j]);
            }
        }
    };

    /**
     * Includes and parses one or more RJSS files. Styles will be applied to any elements you create after calling this.
     */
    context.includeRJSS = redux.fn.includeRJSS;

    /**
     * Injects Redux in to a particular object.
     */
    context.inject = inject;

    /**
     * Create a shorthand for redux itself -- $ or R, if they are available.
     */
    context['R'] = context['R'] || redux;
    return redux;
}