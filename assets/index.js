const SVG_DEF = '<svg enable-background="new 0 0 515.556 515.556" viewBox="0 0 515.556 515.556" xmlns="http://www.w3.org/2000/svg"><path class="signalCheck" d="m0 274.226 176.549 176.886 339.007-338.672-48.67-47.997-290.337 290-128.553-128.552z"/></svg>'

var split = Split(['#codebase', '#waveviewer'], {
    sizes: [50, 50],
    direction: 'vertical',
    dragInterval: 40,
    gutterSize: 30,
    gutterStyle: function(dimension, gutterSize) {
        return {
            'width': '100%',
            'height': '2vh',
            'cursor': 'n-resize',
            'dragInterval': 30,
        }
    }
})

// Register event handlers
document.getElementById ("darkmode").addEventListener ("change", () => {
    document.documentElement.setAttribute ("theme", document.getElementById ("darkmode").checked ? "dark" : "light")
    window.localStorage.ice40DarkMode = document.getElementById ("darkmode").checked
    if (window.codeEditor) {
        window.codeEditor.resize()
        window.codeEditor.setTheme (document.getElementById ("darkmode").checked ? "ace/theme/chaos" : "ace/theme/chrome")
    }
})

function settingsActive() {
    if (window.keepSettingsOpen) return
    Array.from (document.getElementsByClassName ("item")).forEach (e => {e.style.opacity = '1'}) 
    Array.from (document.getElementsByClassName ("item")).forEach (e => {e.style.height = '6vh'})
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.height = '100%'}) 
    document.getElementById ("testlist").style.height = '3vh'
}
function settingsInactive() {
    if (window.keepSettingsOpen) return
    Array.from (document.getElementsByClassName ("item")).forEach (e => {e.style.height = '0px'}) 
    Array.from (document.getElementsByClassName ("item")).forEach (e => {e.style.opacity = '0'})
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.height = '0'; e.style.opacity = '0'}) 
    document.getElementById ("testlist").style.height = '0'
}
document.getElementById ("dropbtn").addEventListener ("mouseenter", settingsActive)
document.getElementById ("dropbtn").addEventListener ("click", () => {window.keepSettingsOpen = window.keepSettingsOpen ? false : true})
document.getElementById ("dropcontent").addEventListener ("mouseenter", settingsActive)
document.getElementById ("dropbtn").addEventListener ("mouseenter", settingsActive)
document.getElementById ("dropbtn").addEventListener ("mouseleave", settingsInactive)
document.getElementById ("dropcontent").addEventListener ("mouseleave", settingsInactive)

Array.from (document.getElementsByClassName ("item")).forEach (elm => elm.addEventListener ('mouseenter', testsInactive))

function testsActive() {
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.opacity = "1"})
}
function testsInactive() {
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.opacity = "0"})
}
document.getElementById ("testlist").addEventListener ("mouseenter", testsActive)
// document.getElementById ("testlist").addEventListener ("mousemove", testsActive)
// document.getElementById ("testlist").addEventListener ("mouseleave", testsInactive)

// Set up ace editors
window.codeEditor = ace.edit("codeview")
document.getElementById('codeview').style.fontSize='14px'
window.codeEditor.setTheme("ace/theme/chaos")
window.codeEditor.session.setMode("ace/mode/verilog")
window.codeEditor.setOptions({
    "printMargin": 0
})
if (window.localStorage.savedCode)
    window.codeEditor.setValue (window.localStorage.savedCode, -1)
else
    fetch ("assets/sourcecode.sv").then (val => val.text()).then (text => {
        window.codeEditor.setValue (text, -1)
    })

// Retrieve testbench list
fetch ((window.location.pathname + "/tests").replace (/\/\//g, '/')).then (val => val.text()).then (text => {
    if (JSON.parse (text).includes (localStorage.lastSetTest)) {
        window.selected_test = localStorage.lastSetTest
        document.getElementById ("droptest").innerHTML = localStorage.lastSetTest
    }
    else {
        window.selected_test = JSON.parse (text).slice (JSON.parse (text).length - 1)[0]
        document.getElementById ("droptest").innerHTML = JSON.parse (text).slice (JSON.parse (text).length - 1)[0]
    }
    JSON.parse (text).forEach (test => {
        var elm = document.createElement('button')
        elm.classList.add ('subbtn')
        elm.innerHTML = test
        elm.value = test
        elm.addEventListener ("click", (e) => {
            document.getElementById ("droptest").innerHTML = e.target.value
            window.selected_test = e.target.value
            localStorage.lastSetTest = e.target.value
            settingsInactive()
        })
        // elm.addEventListener ("mouseleave", testsInactive)
        document.getElementById ("testlist").appendChild (elm)
    })

    // Let's disable making new testbenches for now...
    // var elm = document.createElement('button')
    // elm.classList.add ('subbtn')
    // elm.id = 'newtestbench'
    // elm.innerHTML = "New..."
    // elm.value = "new"
    // elm.addEventListener ("click", (e) => {
    //     writeNewWaveform()
    //     settingsInactive()
    // })
    // elm.addEventListener ("mouseleave", testsInactive)
    // document.getElementById ("testlist").appendChild (elm)
})

document.body.addEventListener ('keydown', (e) => {
    if (e.key == "Escape" && Array.from (document.getElementsByClassName ("overlay")).filter (e => e.style.display == "flex").length > 0) {
        toggleTestOutput(1)
        toggleSignalPanel(1)
    }
    else if (e.key.match (/s$/i) && e.ctrlKey && e.type == 'keydown') {
        e.preventDefault()
        simulate()
    }
})

var simulate = () => {
    if (document.querySelector ('#waveidle') == null) {
        document.querySelector ('#waveviewer').innerHTML = '<p id="waveidle">Waiting for response...</p>'
    }
    else {
        document.getElementById ("waveidle").style.opacity = 1
        document.getElementById ("waveidle").style.display = ''
        document.getElementById ("waveidle").innerHTML = "Waiting for response..."
    }
    Array.from (document.querySelectorAll ('.signalTglSingle,.signalTglBus')).forEach (e => e.remove())
    fetch ((window.location.pathname + '/simulate').replace (/\/\//g, '/'), {
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify ({code: window.codeEditor.getValue(), test: window.selected_test}),
        method: "POST"
    })
    .then (res => res.json())
    .then (data => {
        window.show_only_signals = undefined
        window.response_data = data
        if (data.status == 'success') {
            if (data.hash.includes ("PRINT: ")) {
                window.show_only_signals = data.hash.split ("\n").filter (e => e.startsWith ("PRINT: "))[0].replace (/PRINT: /g, '').split (", ")
                window.unique_hash = data.hash.split ("\n").filter (e => !(e.startsWith ("PRINT: "))).join ('\n')
            }
            else {
                window.unique_hash = data.hash
            }
            if (window.unique_hash.startsWith ("INVALID")) {
                window.failed_tests = window.unique_hash.replace (/INVALID[\n]?/g, '')
            }
            setTimeout (() => { 
                if (window.unique_hash.startsWith ("INVALID")) {
                    window.alert ("The testbench reported the following errors (also viewable by clicking the \"View test logs\" button): \n" + window.failed_tests)
                    toolOutputBox.value = window.failed_tests
                }
                else {
                    window.prompt (
                        "Your code satisifed all requirements for this testbench.  Your simulation identifier is displayed " +
                        "below for you to copy.  Note this down, and submit in your post-lab, along with the exact code you " +
                        "used for this simulation.", window.unique_hash
                    )
                    toolOutputBox.value = 'You successfully passed all tests.  Your simulation identifier is ' + window.unique_hash
                }

                try {
                    if (data.vcd != 'novcdrequired') {
                        createWaveform (data.vcd);
                        initSignalToggle();
                    }
                    else {
                        document.getElementById ("waveidle").innerHTML = 'No waveform was produced by this testbench.'
                    }
                }
                catch (err) {
                    alert ("An error occurred attempting to parse waveform data.  Let course staff know.  The error was: \n\n" + err.stack.toString())
                    toolOutputBox.value += "An error occurred attempting to parse waveform data.  Let course staff know.  The error was: \n\n" + err.stack.toString()
                }

                // If testbench has defined "show only signals", hide everything and show only those bits
                if (data.vcd != 'novcdrequired' && window.show_only_signals != undefined) {
                    toggleAllSignals(1);
                    window.show_only_signals.forEach (e => {
                        document.querySelector ('#signaltoggle_' + e.replace ('[', '_').replace (']', '')).click()
                    })
                }

            }, 300)
            // document.getElementById ("waveforms").style.display = 'flex'
        }
        else {
            console.log (data.reason)
            if (typeof data.reason == "object" && 'stderr' in data.reason)
                alert ("Error occurred: \n" + data.reason.stderr)
            else
                alert ("Error occurred: \n" + data.reason)
        }
    })
}

document.getElementById ("btn_simulate").addEventListener ("click", simulate)

var signals = [], multisignals = {}

function initSignalToggle() {
    var labels = Array.from (document.querySelectorAll ('.waverow,.subwaverow')).slice(1).map (e => e.querySelector ('p').innerHTML)
    var singles = labels.filter (sig => labels.filter (e => e.startsWith (sig)).length == 1 && !(sig.includes ('[')))
    var busnames = labels.filter (sig => !(singles.includes (sig) || sig.includes ('[')))

    singles.forEach (sig => {
        var sgdiv = document.createElement ('div')
        sgdiv.classList.add ('signalTglSingle', 'signalTglSingle-active')
        sgdiv.addEventListener ('click', signalToggleHandler)
        sgdiv.id = 'signaltoggle_' + sig
        var sgp = document.createElement ('p')
        sgp.classList.add ('unselectable')
        sgp.innerHTML = sig
        sgdiv.appendChild (sgp)
        document.getElementById ('signalList').querySelector ('.singleSignalList').appendChild (sgdiv)
    })
    busnames.forEach (sig => {
        var sgdiv = document.createElement ('div')
        sgdiv.classList.add ('signalTglBus')
        sgdiv.id = 'signaltoggle_' + sig
        
        var sgp = document.createElement ('p')
        sgp.classList.add ('unselectable')
        sgp.style.marginLeft = '0.5vw'
        sgp.innerHTML = sig
        sgdiv.appendChild (sgp)

        var busbits = document.createElement ('div')
        busbits.classList.add ('singleSignalList')
        busbits.style.width = '50%'
        busbits.style.paddingTop = '2vh'
        busbits.style.paddingBottom = '0.25vh'
        busbits.style.border = '1px solid var(--line-color)'
        busbits.style.borderRadius = '5px'
        labels.filter (e => e.startsWith (sig + '[')).forEach (bit => {
            var sgdiv = document.createElement ('div')
            sgdiv.classList.add ('signalTglSingle', 'signalTglSingle-active')
            sgdiv.id = 'signaltoggle_' + sig + '_' + bit.match ('\\[([0-9]+)\\]')[1]
            sgdiv.addEventListener ('click', signalToggleHandler)
            sgdiv.parentBus = sig
            sgdiv.style.width = 'max-content'
            var sgp = document.createElement ('p')
            sgp.classList.add ('unselectable')
            sgp.innerHTML = bit.match ('\\[([0-9]+)\\]')[1]
            sgdiv.appendChild (sgp)
            busbits.appendChild (sgdiv)
        })  
        sgdiv.appendChild (busbits)

        document.getElementById ('signalList').appendChild (sgdiv)
    })
}

var turnOnSignal = (e, elm) => { 
    // elm.style.display = 'flex';
    if (e) e.classList.toggle ('signalTglSingle-active', true);
}
var turnOffSignal = (e, elm) => { 
    // elm.style.display = 'none';
    if (e) e.classList.toggle ('signalTglSingle-active', false);
}
var turnOffSignalWithBus = (e, elm, ect) => {
    // if part of a multibit bus, and all the bits are now off, then turn off the multibit bus too
    turnOffSignal (e, elm);
    if (ect.match (/^[0-9]+$/)) {
        var all_bits_off = Array.from (document.querySelectorAll ('.subwaverow'))
            .filter (x => x.id.startsWith ('subwaverow_' + e.parentBus + '_'))
            .filter (x => x.style.display == 'flex').length == 0;
        if (all_bits_off) {
            var parent = document.querySelector ('#waverow_' + e.parentBus)
            parent.style.display = 'none'
            // setTimeout (turnOffSignal.bind (null, null, document.querySelector ('#waverow_' + e.parentBus)), 50)
        }
    }
}

function toggleAllSignals (way) {
    switch (way) {
        case 0:      // turn on
            var all = Array.from (document.querySelectorAll ('.signalTglSingle:not(.signalTglSingle-active)'))
            for (var i = 0; i < all.length; i++) {
                // setTimeout (((e) => { e.click() }).bind (null, all[i]), i * 1)
                all[i].click()
            }
        break;
        case 1:      // turn off
            var all = Array.from (document.querySelectorAll ('.signalTglSingle-active'))
            for (var i = 0; i < all.length; i++) {
                // setTimeout (((e) => { e.click() }).bind (null, all[i]), i * 1)
                all[i].click()
            }
        break;
    }
}

function signalToggleHandler (e) {
    var ect = e.currentTarget.querySelector ('p').innerHTML
    if (ect.match (/^[0-9]+$/)) {   // multi bit signal bit clicked
        var elm = document.querySelector (['#subwaverow', e.currentTarget.parentBus, ect].join ('_'))
    }
    else {
        var elm = document.querySelector (['#waverow', ect].join ('_'))
    }
    // turning on the signal
    if (elm.style.display == 'none') {
        // if part of a multibit bus, and all the bits were off, then turn on the multibit bus first
        // before turning on the bus bit
        if (ect.match (/^[0-9]+$/)) {
            var all_bits_off = Array.from (document.querySelectorAll ('.subwaverow'))
                .filter (x => x.id.startsWith ('subwaverow_' + e.currentTarget.parentBus + '_'))
                .filter (x => x.style.display == 'flex').length == 0;
            if (all_bits_off) {
                var parent = document.querySelector ('#waverow_' + e.currentTarget.parentBus)
                parent.style.display = 'flex'
                turnOnSignal (null, document.querySelector ('#waverow_' + e.currentTarget.parentBus))
            }
        }
        elm.style.display = 'flex'
        turnOnSignal (e.currentTarget, elm)
    }
    // turning off the signal
    else {
        elm.style.display = 'none'
        // must enter timeout first before changing bus, so change to bit is registered
        turnOffSignalWithBus (e.currentTarget, elm, ect)
    }
}

function vcdToJSON (vcd) {
    var wave = {}
    signals = [], multisignals = {}
    wave.version = vcd.match (/\$version *([^\n$]+)\n* *\$end/)[1].trim()
    wave.date = vcd.match (/\$date *([^\n$]+)\n* *\$end/)[1].trim()
    wave.timescale = vcd.match (/\$timescale *([^\n$]+)\n* *\$end/)[1].trim()
    
    wave.signal_map = {}
    
    var port_def_regex = /var wire +([0-9]+) +([^ ]+) +([^\$]+) +\$end/, vcdlines = vcd.split ("\n")
    vcdlines.forEach (sig => {
        // sig.match (port_def_regex)[2] in wave.signal_map added so that submodules do not overwrite the port map for the top module ports
        if (sig.match (port_def_regex) && !signals.includes (sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '')) && !(sig.match (port_def_regex)[2] in wave.signal_map)) {
            signals.push (sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, ''))
            wave.signal_map [sig.match (port_def_regex)[2]] = sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '')
            if (parseInt (sig.match (port_def_regex)[1]) > 1)
                multisignals [sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '')] = sig.match (port_def_regex)[1]
        }
    })
    
    wave.events = {}
    var eventStart = (() => { for (var i = 0; i < vcdlines.length; i++) { if (vcdlines[i].match (/#[0-9]+/)) return i } })(),
        re_time = new RegExp (/#([0-9]+)/),
        re_single = new RegExp (/([0-1])([^ ]+)/),
        re_multiple = new RegExp (/b([0-1]+) ([^ ]+)/),
        currentTime = 0
    for (i = eventStart; i < vcdlines.length; i++) {
        if (vcdlines[i].match (re_time)) {
            wave.events [++currentTime] = {}
        }
        else if (vcdlines[i].match (re_single) && !vcdlines[i].match (re_multiple))
            wave.events [currentTime.toString()][wave.signal_map [vcdlines[i].match (re_single)[2]]] = vcdlines[i].match (re_single)[1]
        else if (vcdlines[i].match (re_multiple))
            wave.events [currentTime.toString()][wave.signal_map [vcdlines[i].match (re_multiple)[2]]] = vcdlines[i].match (re_multiple)[1]
    }
    return wave
}

function zoomIn () {
    pc_re = /([0-9\.]+)\%/
    if (!(parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) < 225))
        return
    Array.from (document.querySelectorAll (".sigval")).forEach (e => {
        e.style.width = (parseFloat (e.style.width.slice (0, e.style.width.indexOf ("v"))) + 0.2).toPrecision (2).toString() + "vw"
    })
    window.wave_width = Array.from (document.querySelectorAll (".sigval"))[0].style.width
    document.getElementById ("zoom_level").innerHTML = (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) + 5).toString() + "%"
}

function zoomOut () {
    pc_re = /([0-9\.]+)\%/
    if (!(parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) > 40))
        return
    Array.from (document.querySelectorAll (".sigval")).forEach (e => {
        e.style.width = (parseFloat (e.style.width.slice (0, e.style.width.indexOf ("v"))) - 0.2).toPrecision (2).toString() + "vw"
    })
    window.wave_width = Array.from (document.querySelectorAll (".sigval"))[0].style.width
    document.getElementById ("zoom_level").innerHTML = (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) - 5).toString() + "%"
}

function horizontalResizeMouse (e) {
    if (e.ctrlKey && e.shiftKey) {
        pc_re = /([0-9\.]+)\%/
        if (e.detail < 0 && parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) < 225) // up 
            zoomIn ()
        else if (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) > 40) // down
            zoomOut ()
        e.preventDefault()
    }
}

function submitTestbench() {
    fetch ((window.location.pathname + "/writetest").replace (/\/\//g, '/'), {
        'method': 'POST',
        'headers': { 'Content-Type': 'application/json' },
        'body': JSON.stringify({ 'wave': window.wave, 'testname': prompt ("Enter a testbench name to save: ").replace (/[^a-z0-9]+/g, '') })
    }).then (val => val.text()).then (text => {
        if (JSON.parse (text).status == 'success') {
            var isAlreadyExisting = Array.from (document.getElementById ("testlist").children)
                                    .map (e => (e.tagName == "BUTTON" && e.innerHTML == JSON.parse (text).test))
                                    .reduce ((acc, cur) => { return acc || cur }, false)
            
            if (!isAlreadyExisting) {
                var newbutton = document.getElementById ("newtestbench")
                var elm = document.createElement('button')
                elm.classList.add ('subbtn')
                elm.innerHTML = JSON.parse (text).test
                elm.value = JSON.parse (text).test
                elm.addEventListener ("click", (e) => {
                    document.getElementById ("droptest").innerHTML = e.target.value
                    window.selected_test = e.target.value
                    settingsInactive()
                })
                // elm.addEventListener ("mouseleave", testsInactive)
                document.getElementById ("testlist").insertBefore (elm, newbutton)
            }
        }
        else {
            alert (JSON.parse (text).reason)
        }
    })
}

async function writeNewWaveform() {
    document.getElementById ("savetestbenchbtn").style.display = 'flex'
    signals = ['hz100', 'pb', 'reset', 'txready', 'rxdata', 'rxready']
    multisignals = { 'pb': 21, 'rxdata': 8 }
    window.wave = {
        'date': new Date().toString(),
        'events': {
            '1': { 'hz100': '1', 'pb': '000000000000000000000', 'reset': '0', 'txready': '0', 'rxdata': '00000000', 'rxready': '0' },
            '2': { 'hz100': '0' },
            '3': { 'hz100': '1' },
            '4': { 'hz100': '0' },
            '5': { 'hz100': '1' },
            '6': { 'hz100': '0' },
            '7': { 'hz100': '1' },
            '8': { 'hz100': '0' },
            '9': { 'hz100': '1' },
            '10': { 'hz100': '0' }
        },
        'signal_map': {
            '0': 'hz100',
            '1': 'pb',
            '2': 'reset',
            '3': 'txready',
            '4': 'rxdata',
            '5': 'rxready'
        },
        'timescale': '1ps',
        'version': 'No version.  Manually generated.'
    }
    document.getElementById ("waveidle").style.opacity = '0'
    
    // wait for opacity to recede and do work in background.  Then, continue to set up waves for editing
    await new Promise ((resolve, reject) => {
        try { 
            document.getElementById ("waveidle").style.display = ''
            // Array.from (document.getElementById ("signalList").children).forEach (e => e.remove())
            initWaveform()
            drawWaveform(window.wave);
            setTimeout (() => { resolve () }, 300) 
        }
        catch (err) { reject (err) }
    })

    // ensure that text in single bit waves is not selectable otherwise you'll get weird white patches

    document.querySelectorAll (".port.sigval").forEach (e => {
        if (e.parentElement.id.match ((/^(.+)_([0-9]+)_([0-9]+)$/))) {
          e.style ['-webkit-touch-callout'] = 'none';
          e.style ['-webkit-user-select'] = 'none';
          e.style ['-khtml-user-select'] = 'none';
          e.style ['-moz-user-select'] = 'none';
          e.style ['-ms-user-select'] = 'none';
          e.style ['user-select'] = 'none';
        }
      })

    /* 
        allow editing of buses to specify multiple bits at once
        allow toggling of bits or single signals to 1 or 0
            if the signal is a bit of a bus, update the bus value
    */

    function bitToggle (evt, mode='toggle') {
        if (mode == 'up') {
            evt.target.style.borderBottom = ''; evt.target.style.borderTop = '1px solid green';
        }
        else if (mode == 'down') {
            evt.target.style.borderBottom = '1px solid green'; evt.target.style.borderTop = '';
        }
        else if (evt.target.style.borderBottom == "")  {   // bit is 1, set to 0 
            evt.target.style.borderBottom = '1px solid green'; evt.target.style.borderTop = '';
        }
        else if (evt.target.style.borderTop == "") {
            evt.target.style.borderBottom = ''; evt.target.style.borderTop = '1px solid green';
        }
        else {
            console.log ("Wait. That's illegal."); console.log (evt.target)
        }
    }

    function updateUponToggle (evt) {
        var p_elm = evt.target
        var bit_id_match = p_elm.parentElement.id.match (/^(.+)_([0-9]+)_([0-9]+)$/)
        var level_1_match = p_elm.parentElement.id.match (/^(.+)_([0-9]+)$/)

        if (!bit_id_match && level_1_match) {
            var newValue = (!p_elm.style.borderBottom ? "1" : !p_elm.style.borderTop ? "0" : (() => { alert ("An error occurred while recalculating waveform values."); return 'err' })())
            
            if (!(level_1_match[1] in window.wave.events [level_1_match[2]]))
                window.wave.events [level_1_match[2]] [level_1_match[1]] = '0'

                window.wave.events [level_1_match[2]] [level_1_match[1]] = newValue
        }
        else if (!bit_id_match || bit_id_match.length < 4 || !bit_id_match[1] in multisignals) {
            console.log ("Wait. That's illegal."); console.log (p_elm.parentElement.id); console.log (bit_id_match); 
        }
        else {
            if (!(bit_id_match[1] in window.wave.events [bit_id_match[3]]))
                window.wave.events [bit_id_match[3]] [bit_id_match[1]] = '0'.repeat (parseInt (multisignals [bit_id_match[1]]))
    
            var newValue = (window.wave.events [bit_id_match[3]] [bit_id_match[1]].slice (0, parseInt (multisignals [bit_id_match[1]]) - parseInt (bit_id_match[2]) - 1)) + 
                           (!p_elm.style.borderBottom ? "1" : !p_elm.style.borderTop ? "0" : (() => { alert ("An error occurred while recalculating waveform values."); return 'err' })()) +
                           (window.wave.events [bit_id_match[3]] [bit_id_match[1]].slice (parseInt (multisignals [bit_id_match[1]]) - parseInt (bit_id_match[2])));
    
            document.querySelector ("#" + bit_id_match[1] + "_" + bit_id_match[3] + " p").innerHTML = window.busFormat == 'x' ? parseInt (newValue, 2).toString(16) : window.busFormat == 'b' ? newValue : parseInt (newValue, 2).toString()
            window.wave.events [bit_id_match[3]] [bit_id_match[1]] = newValue
        }
    }

    var all_p = document.querySelectorAll (".signal.sigval,.port.sigval")
    all_p.forEach (p => {
        if (p.parentElement.id.includes ("hz100"))  // do not touch hz100 because that must be a fixed clock... for now
            return
        else if (p.innerHTML == '&nbsp;') { // must be a single wave or a bit
            p.style.cursor = 'pointer'
            p.onmousedown = (evt) => {
                window.bitTogglingDrag = true
                bitToggle (evt, (evt.ctrlKey || evt.altKey || evt.metaKey) ? 'up' : evt.shiftKey ? 'down' : 'toggle')
                updateUponToggle (evt)
            }
            p.onmouseenter = (evt) => {
                if (window.bitTogglingDrag) {
                    bitToggle (evt, (evt.ctrlKey || evt.altKey || evt.metaKey) ? 'up' : evt.shiftKey ? 'down' : 'toggle')
                    updateUponToggle (evt)
                }
            }
            p.onmouseup = (evt) => { window.bitTogglingDrag = false }
            
        }
        else {  // must be a multibit bus
            p.style.cursor = 'pointer'
            p.setAttribute ('contenteditable', 'true')
            p.onmousedown = (evt) => { evt.target.setAttribute ('contenteditable', 'true'); }
            p.onkeydown = (evt) => {
                if (evt.key == "Enter") {
                    evt.preventDefault()
                    // remove newline
                    evt.target.innerHTML = evt.target.innerHTML.replace (/\<br\>|\r?\n/g, '')

                    if (evt.target.innerHTML.startsWith ("0b")) {
                        evt.target.innerHTML = window.busFormat == 'b' ? evt.target.innerHTML : window.busFormat == 'x' ? '0x' + parseInt (evt.target.innerHTML.slice (2), 2).toString (16) : parseInt (evt.target.innerHTML.slice (2), 2).toString()
                    }
                    else if (evt.target.innerHTML.startsWith ("0x")) {
                        evt.target.innerHTML = window.busFormat == 'x' ? evt.target.innerHTML : window.busFormat == 'b' ? '0b' + parseInt (evt.target.innerHTML, 16).toString (2) : parseInt (evt.target.innerHTML, 16).toString()
                    }
                    else if (!evt.target.innerHTML.match (/^[0-9]+$/)) {
                        alert ("Please type a valid hexadecimal (prefix 0x), binary (prefix 0b), or decimal (no prefix) value.  Hex and binary values will be converted to decimal form (for now).")
                        evt.target.innerHTML = "0"
                    }
                    evt.target.setAttribute ('contenteditable', 'false')
                    
                    // update bits based on changed value of bus
                    var bus_id_match = evt.target.parentElement.id.match (/^(.+)_([0-9]+)$/)
                    var newValue = window.busFormat == 'x' ? parseInt (evt.target.innerHTML, 16).toString (2) : window.busFormat == 'b' ? evt.target.innerHTML.slice (2) : parseInt (evt.target.innerHTML).toString (2)

                    if (!bus_id_match || bus_id_match.length < 3 || !bus_id_match[1] in multisignals) {
                        console.log ("Wait. That's illegal."); console.log (evt.target.parentElement.id); console.log (bus_id_match); 
                    }
                    else {
                        if (!(bus_id_match[1] in window.wave.events [bus_id_match[2]]))
                            window.wave.events [bus_id_match[2]] [bus_id_match[1]] = '0'.repeat (parseInt (multisignals [bus_id_match[1]]))

                        if (newValue.length < parseInt (multisignals [bus_id_match[1]])) {
                            newValue = "0".repeat (parseInt (multisignals[bus_id_match[1]]) - newValue.length) + newValue
                        }
                        else if (parseInt (newValue, 2) > Math.pow (2, parseInt (multisignals [bus_id_match[1]])) - 1) {
                            alert ("You have attempted to set a value higher than the permissible limit for this bus.  The text will now be set to that value.")
                            newValue = "1".repeat (multisignals [bus_id_match[1]])
                            evt.target.innerHTML = window.busFormat == 'x' ? parseInt (newValue, 2).toString(16) : window.busFormat == 'b' ? newValue : parseInt (newValue, 2).toString()
                        }

                        for (var i = parseInt (multisignals [bus_id_match[1]]) - 1; i >= 0; i--) {
                            var p = document.querySelector ("#" + bus_id_match[1] + "_" + i.toString() + "_" + bus_id_match[2] + " p")
                            if (p.style.borderBottom == "" && newValue [parseInt (multisignals [bus_id_match[1]]) - i - 1] == "0")  {   // bit is 1, set to 0 
                                p.style.borderBottom = '1px solid green'; p.style.borderTop = '';
                            }
                            else if (p.style.borderTop == "" && newValue [parseInt (multisignals [bus_id_match[1]]) - i - 1] == "1") {
                                p.style.borderBottom = ''; p.style.borderTop = '1px solid green';
                            }
                        }
                        window.wave.events [bus_id_match[2]] [bus_id_match[1]] = newValue
                    }

                    evt.target.blur()
                }
                else if (!evt.key.match (/[^ac-wyz]/))
                    evt.preventDefault()
            }
        }
    })
}

function createWaveform (vcd) {
    if (vcd == 'novcdrequired') return
    try {
        window.vcd = vcd
        json = vcdToJSON (vcd)
        window.wave = json
        console.log (json)
    }
    catch (err) {
        alert ("There was a problem parsing the waveform data returned.  Please check the devtools console for the raw VCD and error.")
        console.log (vcd)
        console.error (err)
    }
    // draw signals
    document.getElementById ("waveidle").innerHTML = 'Rendering waveforms...<br>You may need to wait if the test is a long one.  Give the page some time.'
    // Array.from (document.getElementById ("signalList").children).forEach (e => e.remove())
    // initWaveform()
    // drawWaveform(json)
    var hidden_inputs = Object.values (window.wave.signal_map).map (sig => {
        var x = {}
        x [sig] = ''
        var val = ''
        if (window.wave.events[1][sig].length > 1) {
            // multisignal
            for (var i = 0; i < Object.values (window.wave.events).length; i++) {
                if (val != Object.values (window.wave.events)[i][sig] && !(Object.values (window.wave.events)[i][sig] == undefined)) {
                    val = Object.values (window.wave.events)[i][sig]
                }
                x [sig] += val + ','
            }
            x [sig] = x [sig].slice (0, x [sig].length - 1) // remove extra comma
        }
        else {
            for (var i = 0; i < Object.values (window.wave.events).length; i++) {
                if (val != Object.values (window.wave.events)[i][sig] && !(Object.values (window.wave.events)[i][sig] == undefined)) {
                    val = Object.values (window.wave.events)[i][sig]
                }
                x [sig] += val
            }
        }
        return x
    })
    // in a way, also a sanity check to ensure only real top module is being simulated
    window.wavedraw_inputs = {};
    if (window.vcd != 'novcdrequired') {
        ['hz100', 'reset', 'pb', 'left', 'right', 'ss7', 'ss6', 'ss5', 'ss4', 'ss3', 'ss2', 'ss1', 'ss0', 'red', 'green', 'blue', 
        'txclk', 'txdata', 'txready', 'rxclk', 'rxdata', 'rxready'].forEach (s => {
            try {
                if (!(window.show_only_signals) || (window.show_only_signals.length > 0 && window.show_only_signals.includes (s))) {
                    var d = hidden_inputs.filter (e => Object.keys (e) == s)[0][s]
                    window.wavedraw_inputs [s] = d
                }
            }
            catch (err) {
                window.alert (s + "was not found in JSON.\nError data: " + err.toString()) 
            }
        })
    }
    window.wavedraw_inst = new WaveDraw(document.getElementById ("waveviewer"), {
        fixed: window.wavedraw_inputs,
        editable: {},
        timescale: '1us', // specify the timescale of the waveform - purely cosmetic
        allowXValues: true, //prevents user from toggling X values
        allowZValues: false, //prevents user from toggling Z values
        modifyLength: false, // this will prevent users from changing the time of the waveform
        disabled: true // prevents modifying the waveforms regardless of type of wave
    });
    document.querySelector ("#waveviewer").addEventListener ('wheel', e => {
        if (e.ctrlKey && e.shiftKey && e.deltaY > 0) {  // scroll down, so zoom out
            e.preventDefault()
            Array.from (document.querySelectorAll ('.event')).slice (1).forEach (e => { 
                if (e.style.width == '') {
                    e.style.width = '30px'
                }
                else if (e.style.width.match (/[0-9]{2}px/)) {
                    var val = parseInt (e.style.width.match (/([0-9]{2})px/)[1])
                    e.style.width = (val == 30 ? 30 : val - 10).toString() + 'px'
                }
            })
        }
        else if (e.ctrlKey && e.shiftKey && e.deltaY < 0) { // scroll up, so zoom in
            e.preventDefault()
            Array.from (document.querySelectorAll ('.event')).slice (1).forEach (e => { 
                if (e.style.width == '') {
                    e.style.width = '50px'
                }
                else if (e.style.width.match (/[0-9]{2}px/)) {
                    var val = parseInt (e.style.width.match (/([0-9]{2})px/)[1])
                    e.style.width = (val == 80 ? 80 : val + 10).toString() + 'px'
                }
            })
        }
    })
}
function expandAll() {
    Object.keys (multisignals).forEach (signal => {
        var targetElm = document.getElementById (signal)
        targetElm.children[1].style.display = ''
        Array.from (document.querySelectorAll ("#" + targetElm.id + " > #" + targetElm.id + "_list > *")).forEach (e => {
            e.style.display = ''
        })
        Object.keys (window.wave.events).forEach (time => {
            Array.from (document.querySelectorAll ("#" + targetElm.id + "_list_" + time.toString() + " > *")).forEach (e => {
                e.style.display = ''
            })
        })
        setTimeout (() => { 
            document.getElementById (targetElm.id + '_list').style.opacity = 1
            document.getElementById (targetElm.id + '_list').style.height = '100%'
            for (var t = 1; t < Object.keys (window.wave.events).length + 1; t++) {
                document.getElementById (targetElm.id + '_list_' + t.toString()).style.opacity = 1
                document.getElementById (targetElm.id + '_list_' + t.toString()).style.height = '100%'
                document.getElementById (targetElm.id + '_list_' + t.toString()).style.display = ''
            }
        }, 200)
    });
}

function collapseAll() {
    Object.keys (multisignals).forEach (signal => {
        var targetElm = document.getElementById (signal)
        targetElm.children[1].style.opacity = 0
        targetElm.children[1].style.height = '0'
        Array.from (document.querySelectorAll ("#" + targetElm.id + " > #" + targetElm.id + "_list > *")).forEach (e => {
            e.style.display = 'none'
        })
        Object.keys (window.wave.events).forEach (time => {
            Array.from (document.querySelectorAll ("#" + targetElm.id + "_list_" + time.toString() + " > *")).forEach (e => {
                e.style.display = 'none'
            })
        })
        document.getElementById (targetElm.id + '_list').style.display = 'none'
        for (var t = 1; t < Object.keys (window.wave.events).length + 1; t++) {
            document.getElementById (targetElm.id + '_list_' + t.toString()).style.opacity = 0
            document.getElementById (targetElm.id + '_list_' + t.toString()).style.height = '0%'
            document.getElementById (targetElm.id + '_list_' + t.toString()).style.display = 'none'
        }
    });
}

function manipulateSignal (signal, display) {
    // before changing the signal name, ensure that it is a top-level signal and not a bit of that signal
    if (!signal.includes ("_") || signals.includes (signal))
        document.getElementById (signal).style.display = display
    if (signal in multisignals) {
        for (var i = parseInt (multisignals [signal]) - 1; i > 0; i--) {
            Object.keys (window.wave.events).map (e => (signal + "_" + i.toString() + "_" + e)).forEach (div_id => {
                document.getElementById (div_id).style.display = display
            })
        }
    }
    Object.keys (window.wave.events).map (e => (signal + "_" + e)).forEach (div_id => {
        document.getElementById (div_id).style.display = display
    })
    if (display == '') {
        // Icons made by <a href="https://www.flaticon.com/authors/those-icons" title="Those Icons">Those Icons</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
        document.querySelector ("#toggle_" + signal + " div").innerHTML = SVG_DEF
    }
    else {
        document.querySelector ("#toggle_" + signal + " div").innerHTML = ''
    }
}

function hideSignal (signal) {
    if (typeof signal == "object") {
        signal.forEach (sig => {
            manipulateSignal (sig, 'none')
        })
    }
    else if (typeof signal == "string") {
        manipulateSignal (signal, 'none')
    }
}

function showSignal (signal) {  
    if (typeof signal == "object") {
        signal.forEach (sig => {
            manipulateSignal (sig, '')
        })
    }
    else if (typeof signal == "string") {
        manipulateSignal (signal, '')
    }
}

function toggleTestOutput (opt=-1) {
    if (document.getElementById ("divToolOutput").style.display == "flex" || opt == 1) {
        Array.from (document.querySelectorAll ("header,#settingheader > div > div > p,#settingheader > div > div > button,#dropbtn,#dividerview")).forEach (e => { e.style.filter = "blur(0px)" })
        document.getElementById ("divToolOutput").style.opacity = 0
        document.getElementById ("divToolOutput").style.display = "none"
    }
    else {
        Array.from (document.querySelectorAll ("header,#settingheader > div > div > p,#settingheader > div > div > button,#dropbtn,#dividerview")).forEach (e => { e.style.filter = "blur(3px)" })
        document.getElementById ("divToolOutput").style.display = "flex"
        document.getElementById ("divToolOutput").style.opacity = 1
    }
}

function toggleSignalPanel (opt=-1) {
    if (document.getElementById ("divSignalList").style.display == "flex" || opt == 1) {
        Array.from (document.querySelectorAll ("header,#settingheader > div > div > p,#settingheader > div > div > button,#dropbtn,#dividerview")).forEach (e => { e.style.filter = "blur(0px)" })
        document.getElementById ("divSignalList").style.opacity = 0
        document.getElementById ("divSignalList").style.display = "none"
    }
    else {
        Array.from (document.querySelectorAll ("header,#settingheader > div > div > p,#settingheader > div > div > button,#dropbtn,#dividerview")).forEach (e => { e.style.filter = "blur(3px)" })
        document.getElementById ("divSignalList").style.display = "flex"
        document.getElementById ("divSignalList").style.opacity = 1
    }
}

function toggleSignal (evt) {
    if (evt.target.children[1].innerHTML in multisignals) {
        if (document.getElementById (evt.target.children[1].innerHTML).style.display == 'none') {
            // show all multisignals!
            showSignal (evt.target.children[1].innerHTML)
        }
        else {
            // hide all multisignals!
            hideSignal (evt.target.children[1].innerHTML)
        }
    }
    else {
        if (evt.target.children[1].innerHTML.match (/\[([0-9]+)\]/)) {
            var hostsignal = evt.target.children[1].innerHTML.slice (0, evt.target.children[1].innerHTML.search (/\[/))
            var subsignal = hostsignal + "_" + evt.target.children[1].innerHTML.match (/\[([0-9]+)\]/)[1]
            if (document.getElementById (hostsignal).style.display == 'none')
                showSignal (hostsignal)
            if (document.getElementById (subsignal + "_0").style.display == 'none') {
                document.getElementById (subsignal + "_0").style.display = ''
                showSignal (subsignal)
            }
            else {
                document.getElementById (subsignal + "_0").style.display = 'none'
                hideSignal (subsignal)
            }
        }
        else if (document.getElementById (evt.target.children[1].innerHTML).style.display == 'none') {
            document.getElementById (evt.target.children[1].innerHTML).style.display = ''
            showSignal (evt.target.children[1].innerHTML)
        }
        else {
            document.getElementById (evt.target.children[1].innerHTML).style.display = 'none'
            hideSignal (evt.target.children[1].innerHTML)
        }
    }
}

function drawWaveform (wave) {
    var sig_to_val = {}
    Object.keys (wave.events).forEach ((time) => {
        var signaldiv = document.createElement ("div")
        var waveforms = document.getElementById ("waveforms")
        var allSignalList = document.getElementById ("signalList")
        signaldiv.classList = ["signaldiv"] 

        signals.forEach (sig => {
            signal = document.createElement ("div")
            signal.style.width = window.wave_width
            signal.classList.add ('sigval')
            signal.id = sig.replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '') + '_' + time.toString()
            sigtext = document.createElement ("p") 
            sigtext.classList.add ('signal', 'sigval')
            sigtext.style.width = window.wave_width
            sigtext.style ['text-align'] = 'center'
            if (sig in multisignals && sig in wave.events [time])
                sigtext.innerHTML = parseInt (wave.events [time][sig], 2).toString()
            else if (sig in multisignals)
                sigtext.innerHTML = sig_to_val [sig]
            else if (sig in wave.events [time])
                sigtext.innerHTML = wave.events [time][sig]
            else
                sigtext.innerHTML = sig_to_val [sig]
            sig_to_val[sig] = sigtext.innerHTML

            if (!(sig in multisignals) && sigtext.innerHTML == "1") {
                sigtext.style.borderTop = "1px solid green"
            }
            else if (!(sig in multisignals) && sigtext.innerHTML == "0") {
                sigtext.style.borderBottom = "1px solid green"
            }
            else {
                sigtext.style.border = "1px solid green"
            }
            if (!(sig in multisignals)) {
                sigtext.innerHTML = "&nbsp;"
            }
            // also add to signal show/hide list
            if (time == "1") {
                var sigdiv = document.createElement ("div")
                sigdiv.classList.add ('signalPick')
                sigdiv.id = 'toggle_' + sig
                var sigdivbox = document.createElement ("div")
                sigdivbox.classList.add ('signalPickBox')
                sigdivbox.innerHTML = SVG_DEF
                var sig_p = document.createElement ("p")
                sig_p.style ['-webkit-touch-callout'] = 'none';
                sig_p.style ['-webkit-user-select'] = 'none';
                sig_p.style ['-khtml-user-select'] = 'none';
                sig_p.style ['-moz-user-select'] = 'none';
                sig_p.style ['-ms-user-select'] = 'none';
                sig_p.style ['user-select'] = 'none';
                sig_p.innerHTML = sig
                sig_p.style ['font-size'] = 'calc(0.65vw + 0.35vh)'
                sig_p.style.margin = 0
                sigdiv.appendChild (sigdivbox)
                sigdiv.appendChild (sig_p)
                allSignalList.appendChild (sigdiv)
            }

            sigtext.style ['-webkit-touch-callout'] = 'none';
            sigtext.style ['-webkit-user-select'] = 'none';
            sigtext.style ['-khtml-user-select'] = 'none';
            sigtext.style ['-moz-user-select'] = 'none';
            sigtext.style ['-ms-user-select'] = 'none';
            sigtext.style ['user-select'] = 'none';

            signal.appendChild (sigtext)
            signaldiv.appendChild (signal)
        })
        waveforms.appendChild (signaldiv)

        Object.keys (multisignals).forEach (signal => {
            var bus = document.getElementById (signal + '_' + time.toString())
            var portlist = document.createElement ("div")
            portlist.classList.add ('portlist')
            portlist.id = signal + '_list_' + time.toString()
            portlist.style.opacity = 1
            portlist.style.height = '100%'
            portlist.style.display = ''
            
            for (var i = multisignals [signal] - 1; i >= 0; i--) {
                port = document.createElement ("div")
                port.style.width = window.wave_width
                port.classList.add ('sigval')
                port.id = signal + "_" + i.toString() + "_" + time.toString()
                sigtext = document.createElement ("p") 
                sigtext.classList.add ('port', 'sigval')
                sigtext.style ['text-align'] = 'center'
                sigtext.style.width = window.wave_width
                if (signal in wave.events[time]) // is there new data for this timestamp?
                    sigtext.innerHTML = wave.events [time][signal][multisignals [signal] - 1 - i]
                else    // use value from previous timestamp
                    sigtext.innerHTML = sig_to_val [signal] & (0x1 << i) ? 1 : 0
                
                if (sigtext.innerHTML == "1") {
                    sigtext.style.borderTop = "1px solid green"
                }
                else if (sigtext.innerHTML == "0") {
                    sigtext.style.borderBottom = "1px solid green"
                }
                else {
                    sigtext.style.borderTop = "1px solid green"
                    sigtext.style.borderBottom = "1px solid green"
                }
                sigtext.innerHTML = "&nbsp;"
                port.appendChild (sigtext)
                portlist.appendChild (port)

                // also add to signal show/hide list
                if (time == "1") {
                    var sigdiv = document.createElement ("div")
                    sigdiv.classList.add ('signalPick')
                    sigdiv.id = 'toggle_' + signal + '_' + i.toString()
                    var sigdivbox = document.createElement ("div")
                    sigdivbox.classList.add ('signalPickBox')
                    sigdivbox.innerHTML = SVG_DEF
                    var sig_p = document.createElement ("p")
                    sig_p.style ['    -webkit-touch-callout'] = 'none';
                    sig_p.style ['-webkit-user-select'] = 'none';
                    sig_p.style ['-khtml-user-select'] = 'none';
                    sig_p.style ['-moz-user-select'] = 'none';
                    sig_p.style ['-ms-user-select'] = 'none';
                    sig_p.style ['user-select'] = 'none';
                    sig_p.innerHTML = signal.replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '') + '[' + i.toString() + ']'
                    sig_p.style ['font-size'] = 'calc(0.65vw + 0.35vh)'
                    sig_p.style.margin = '0'
                    sigdiv.appendChild (sigdivbox)
                    sigdiv.appendChild (sig_p)
                    allSignalList.appendChild (sigdiv)
                }
            }
            bus.appendChild (portlist)
        })
    })

    document.querySelectorAll (".signalPick").forEach (e => e.onmousedown = (evt) => {
        window.multiSignalToggle = true; toggleSignal (evt)
    })
    
    document.querySelectorAll (".signalPick").forEach (e => e.onmouseenter = (evt) => {
        if (window.multiSignalToggle) toggleSignal (evt)
    })
    
    document.querySelectorAll (".signalPick").forEach (e => e.onmouseup = (evt) => {
        window.multiSignalToggle = false
    })

    // set border-right transition if XOR of two time events is 1
    for (var j = 0; j < document.querySelectorAll (".signaldiv")[1].querySelectorAll (".port,.signal").length; j++) {
        for (var i = 1; i < Object.keys (wave.events).length; i++) {
            nextWave = document.querySelectorAll (".signaldiv")[i + 1].querySelectorAll (".port,.signal")[j]
            currentWave = document.querySelectorAll (".signaldiv")[i].querySelectorAll (".port,.signal")[j]
            if (nextWave.style.borderTop != "" ^ currentWave.style.borderTop != "")
                nextWave.style.borderLeft = "1px solid green"
        }
    }
}

function initWaveform() {
    var waveforms = document.getElementById ("waveforms")
    var waveviewer = document.getElementById ("waveviewer")
    if (waveforms.style ['justify-content'] == 'flex-start') // already drawn, remove old waveforms
        Array.from (document.getElementsByClassName ("signaldiv")).forEach (evt => evt.remove())
    window.wave_width = "5vw"
    
    document.getElementById ("wavesettings").style.display = 'flex'
    waveforms.style ['display'] = 'flex'
    waveforms.style ['justify-content'] = 'flex-start'
    waveforms.style ['align-items'] = 'flex-start'
    waveviewer.style ['justify-content'] = 'flex-start'
    waveviewer.style ['align-items'] = 'flex-start'
    waveviewer.style ['flex-direction'] = 'column'
    
    var signaldiv = document.createElement ("div")
    signaldiv.classList.add ("signaldiv")
    signaldiv.style ['margin-right'] = '1vw'
    signaldiv.style ['width'] = 'max-content'
    signaldiv.style ['display'] = 'flex'
    signaldiv.style ['flex-direction'] = 'column'
    signaldiv.style ['align-items'] = 'flex-end'

    signals.forEach (sig => {
        signal = document.createElement ("div")
        signal.classList.add ('signame')
        signal.style.width = 'auto'
        signal.id = sig
        sigtext = document.createElement ("p") 
        sigtext.classList.add ('signal')
        sigtext.innerHTML = sig
        sigtext.style ['margin-right'] = "0.5vw"
        signal.appendChild (sigtext)
        signaldiv.appendChild (signal)
    })
    waveforms.appendChild (signaldiv)

    Object.keys (multisignals).forEach (signal => {
        var bus = document.getElementById (signal)
        bus.children[0].style.cursor = 'pointer'
        var portlist = document.createElement ("div")
        portlist.classList.add ('portlist')
        portlist.id = signal + '_list'
        portlist.style.opacity = 1
        portlist.style.height = '100%'
        portlist.style.display = ''
        bus.addEventListener ("click", (e) => {
            var targetElm = e.target.constructor.name == "HTMLParagraphElement" ? e.target.parentNode : e.target
            if (document.getElementById (targetElm.id + '_list').style.opacity == 0) {
                document.getElementById (targetElm.id + '_list').style.display = ''
                Array.from (document.querySelectorAll ("#" + targetElm.id + " > #" + targetElm.id + "_list > *")).forEach (e => {
                    e.style.display = ''
                })
                Object.keys (window.wave.events).forEach (time => {
                    document.getElementById (targetElm.id + '_list_' + time.toString()).style.display = ''
                    Array.from (document.querySelectorAll ("#" + targetElm.id + "_list_" + time.toString() + " > *")).forEach (e => {
                        e.style.display = ''
                    })
                })
                setTimeout (() => {
                    document.getElementById (targetElm.id + '_list').style.opacity = 1
                    document.getElementById (targetElm.id + '_list').style.height = '100%'
                    document.getElementById (targetElm.id + '_list').style.display = ''
                    for (var t = 1; t <= Object.keys (window.wave.events).length; t++) {
                        document.getElementById (targetElm.id + '_list_' + t.toString()).style.opacity = 1
                        document.getElementById (targetElm.id + '_list_' + t.toString()).style.height = '100%'
                        document.getElementById (targetElm.id + '_list_' + t.toString()).style.display = ''
                    }
                }, 200)
            }
            else {
                document.getElementById (targetElm.id + '_list').style.opacity = 0; 
                document.getElementById (targetElm.id + '_list').style.height = '0'
                Array.from (document.querySelectorAll ("#" + targetElm.id + " > #" + targetElm.id + "_list > *")).forEach (e => {
                    e.style.display = 'none'
                })
                Object.keys (window.wave.events).forEach (time => {
                    document.getElementById (targetElm.id + '_list_' + time.toString()).style.opacity = 0; 
                    document.getElementById (targetElm.id + '_list_' + time.toString()).style.height = '0'
                    Array.from (document.querySelectorAll ("#" + targetElm.id + "_list_" + time.toString() + " > *")).forEach (e => {
                        e.style.display = 'none'
                    })
                })
                setTimeout (() => { 
                    document.getElementById (targetElm.id + '_list').style.opacity = 0
                    document.getElementById (targetElm.id + '_list').style.height = '0%'
                    document.getElementById (targetElm.id + '_list').style.display = 'none'
                    for (var t = 1; t < Object.keys (window.wave.events).length + 1; t++) {
                        document.getElementById (targetElm.id + '_list_' + t.toString()).style.opacity = 0
                        document.getElementById (targetElm.id + '_list_' + t.toString()).style.height = '0%'
                        document.getElementById (targetElm.id + '_list_' + t.toString()).style.display = 'none'
                    }
                }, 300)
            }
        })
        
        for (i = multisignals [signal] - 1; i >= 0; i--) {
            port = document.createElement ("div")
            port.style.width = window.wave_width
            port.id = signal + "_" + i.toString() + "_0"
            sigtext = document.createElement ("p") 
            sigtext.classList.add ('port')
            sigtext.style ['margin-right'] = "0.5vw"
            sigtext.innerHTML = signal.replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '') + "[" + i.toString() + "]"
            port.appendChild (sigtext)
            portlist.appendChild (port)
        }
        bus.appendChild (portlist)
    })
}

function show_sim_hash() {
    if (window.unique_hash == undefined) {
        window.alert ("Your identifier will not be produced until you have verified that your code is working on HDLwave with this week's testbench  Click Simulate, and then try again.")
    }
    else if (window.unique_hash.startsWith ("INVALID")) {
        window.alert ("The last testbench you ran on your code did not satisfy all tests.  " + 
                      "Your identifier is only generated when your code successfully passes these tests.  The tests that failed include: \n" 
                      + (window.failed_tests || 'No test data was produced.'))
    }
    else {
        window.prompt ("Well done!  You passed all the test cases for this lab assignment!\n\nThe unique identifier for your simulation is in the input box below.  " + 
        "Keep in mind that this only indicates " + 
        "that your code satisfied the basic test cases.  Ensure that your design runs as indicated in lab documents with the help of the demo animation " +
        "at the end of the final step.  Clicking OK or Cancel below will not make a difference.", window.unique_hash)
    }
}

window.onbeforeunload = () => {
    window.localStorage.savedCode = window.codeEditor.getValue()
}

// check if simulator opened the page, and retrieve code
window.addEventListener("message", (event) => {
    if (event.origin !== "https://verilog.ecn.purdue.edu") return;
    try {
        var code = event.data.code;
        window.codeEditor.setValue (code);
        var testbench = event.data.testbench;
        
        if (testbench != '') {
            console.log ("User preset testbench " + testbench);
            fetch ((window.location.pathname + "/tests").replace (/\/\//g, '/')).then (val => val.text()).then (text => {
                if (JSON.parse (text).includes (testbench)) {
                    localStorage.lastSetTest = testbench;
                    window.selected_test = testbench;
                    document.getElementById ("droptest").innerHTML = testbench;
                    simulate();
                }
                else {
                    alert ("You specified a testbench, but it does not exist: " + testbench + ".  The available testbenches " +
                           "include: " + JSON.parse (text).join (', ') + ".");
                }
            });
        }
    }
    catch (err) {
        alert ("Failed to load code from simulator.  Error was " + err.toString())
    }
}, false);

window.onload = () => {
    // document.documentElement.setAttribute ("theme", "light")
    // document.documentElement.setAttribute ("waveview", "true")

    // document.getElementById ("waveforms").addEventListener ("DOMMouseScroll", horizontalResizeMouse)
    // document.getElementById ("waveforms").addEventListener ("mousewheel", horizontalResizeMouse)

    if (window.localStorage.savedCode)
        window.codeEditor.setValue (window.localStorage.savedCode, -1)
    if (window.localStorage.ice40DarkMode == "true") {
        document.documentElement.setAttribute ("theme", "dark")
        window.localStorage.ice40DarkMode = document.getElementById ("darkmode").checked = true
        window.codeEditor.setTheme ("ace/theme/chaos")
    }
    else {
        document.documentElement.setAttribute ("theme", "light")
        window.localStorage.ice40DarkMode = document.getElementById ("darkmode").checked = false
        window.codeEditor.setTheme ("ace/theme/chrome")
    }
    document.getElementById ("overlay").style.opacity = '0'
    setTimeout (() => { document.getElementById ("overlay").style.display = 'none' }, 500)

    if (window.location.search.match (/\?encoded=[\w\=\+\/]+/)) {
        try {
            var code = atob (window.location.search.match (/\?encoded=([\w\=\+\/]+)/)[1])
            window.codeEditor.setValue (code, -1)
            window.localStorage.savedCode = code
        }
        catch (err) {
            window.alert ("Error in parameter: " + err.toString())
        }
    }

    if (window.opener) {
        window.opener.postMessage ("Ready")
    }
    
}
