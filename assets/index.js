const SVG_DEF = '<svg enable-background="new 0 0 515.556 515.556" viewBox="0 0 515.556 515.556" xmlns="http://www.w3.org/2000/svg"><path class="signalCheck" d="m0 274.226 176.549 176.886 339.007-338.672-48.67-47.997-290.337 290-128.553-128.552z"/></svg>'

var split = Split(['#codebase', '#waveviewer'], {
    sizes: [50, 50],
    direction: 'vertical',
    dragInterval: 10,
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
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.height = '0'}) 
    document.getElementById ("testlist").style.height = '0'
}
document.getElementById ("dropbtn").addEventListener ("mouseenter", settingsActive)
document.getElementById ("dropbtn").addEventListener ("click", () => {window.keepSettingsOpen = window.keepSettingsOpen ? false : true})
document.getElementById ("dropcontent").addEventListener ("mousemove", settingsActive)
document.getElementById ("dropbtn").addEventListener ("mousemove", settingsActive)
document.getElementById ("testlist").addEventListener ("mousemove", settingsActive)
document.getElementById ("dropbtn").addEventListener ("mouseleave", settingsInactive)
document.getElementById ("dropcontent").addEventListener ("mouseleave", settingsInactive)

function testsActive() {
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.opacity = "1"})
}
function testsInactive() {
    Array.from (document.getElementsByClassName ("subbtn")).forEach (e => {e.style.opacity = "0"})
}
document.getElementById ("testlist").addEventListener ("mouseenter", testsActive)
document.getElementById ("testlist").addEventListener ("mousemove", testsActive)
document.getElementById ("testlist").addEventListener ("mouseleave", testsInactive)

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
    window.selected_test = JSON.parse (text)[0]
    document.getElementById ("droptest").innerHTML = JSON.parse (text)[0]
    JSON.parse (text).forEach (test => {
        var elm = document.createElement('button')
        elm.classList.add ('subbtn')
        elm.innerHTML = test
        elm.value = test
        elm.addEventListener ("click", (e) => {
            document.getElementById ("droptest").innerHTML = e.target.value
            window.selected_test = e.target.value
            settingsInactive()
        })
        elm.addEventListener ("mouseleave", testsInactive)
        document.getElementById ("testlist").appendChild (elm)
    })
    var elm = document.createElement('button')
    elm.classList.add ('subbtn')
    elm.innerHTML = "New..."
    elm.value = "new"
    elm.addEventListener ("click", (e) => {
        writeNewWaveform()
        settingsInactive()
    })
    elm.addEventListener ("mouseleave", testsInactive)
    document.getElementById ("testlist").appendChild (elm)
})

document.body.addEventListener ('keydown', (e) => {
    if (e.key == "Escape" && document.getElementById ("divSignalList").style.display == "flex") {
        toggleSignalPanel()
    }
})

document.getElementById ("btn_simulate").addEventListener ("click", () => {
    // if (!window.codeEditor.getValue().includes ("$dumpfile") || !window.codeEditor.getValue().includes ("$dumpvars")) {
    //     alert ("To be able to view traces, you will need to include the necessary $dumpfile/$dumpvars directives.  Read the help page to learn how to do this.")
    //     return
    // }
    document.getElementById ("waveforms").style.display = 'none'
    document.getElementById ("waveidle").style.opacity = 1
    document.getElementById ("waveidle").style.display = ''
    document.getElementById ("waveidle").innerHTML = "Waiting for response..."
    fetch ((window.location.pathname + '/simulate').replace (/\/\//g, '/'), {
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify ({code: window.codeEditor.getValue(), test: window.selected_test}),
        method: "POST"
    })
    .then (res => res.json())
    .then (data => {
        if (data.status == 'success') {
            document.getElementById ("waveidle").innerHTML = "Rendering response..."
            createWaveform (data.vcd)
            document.getElementById ("waveforms").style.display = 'flex'
        }
        else {
            console.log (data.reason)
            if ('stderr' in data.reason)
                alert ("Error occurred: \n" + data.reason.stderr)
            else
                alert ("Error occurred: \n" + data.reason)
        }
    })
})

var signals = [], multisignals = {}

function vcdToJSON (vcd) {
    var wave = {}
    signals = [], multisignals = {}
    wave.version = vcd.match (/\$version *([^\n$]+)\n* *\$end/)[1].trim()
    wave.date = vcd.match (/\$date *([^\n$]+)\n* *\$end/)[1].trim()
    wave.timescale = vcd.match (/\$timescale *([^\n$]+)\n* *\$end/)[1].trim()
    
    wave.signal_map = {}
    
    var port_def_regex = /var wire +([0-9]+) +(.) +([^\$]+) +\$end/, 
        vcdlines = vcd.split ("\n")
    vcdlines.forEach (sig => {
        if (sig.match (port_def_regex) && !signals.includes (sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, ''))) {
            signals.push (sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, ''))
            wave.signal_map [sig.match (port_def_regex)[2]] = sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '')
            if (parseInt (sig.match (port_def_regex)[1]) > 1)
                multisignals [sig.match (port_def_regex)[3].replace (/\[[0-9]+\:0\]/, '').replace (/ /g, '')] = sig.match (port_def_regex)[1]
        }
    })
    
    wave.events = {}
    var eventStart = vcdlines.indexOf ("#1"),
        re_time = new RegExp (/#([0-9]+)/),
        re_single = new RegExp (/([0-1])([^ ])/),
        re_multiple = new RegExp (/b([0-1]+) (.)/),
        currentTime = 0
    for (i = eventStart; i < vcdlines.length; i++) {
        if (vcdlines[i].match (re_time)) {
            currentTime++
            wave.events [vcdlines[i].match (re_time)[1]] = {}
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

async function writeNewWaveform() {
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
            document.getElementById ("waveidle").style.display = 'none'
            Array.from (document.getElementById ("signalList").children).forEach (e => e.remove())
            initWaveform()
            drawWaveform(window.wave);
            setTimeout (() => { resolve () }, 300) 
        }
        catch (err) { reject (err) }
    })

    /* 
        allow editing of buses to specify multiple bits at once
        allow toggling of bits or single signals to 1 or 0
            if the signal is a bit of a bus, update the bus value
    */

    function bitToggle (evt) {
        if (evt.target.style.borderBottom == "")  {   // bit is 1, set to 0 
            evt.target.style.borderBottom = '1px solid green'; evt.target.style.borderTop = '';
        }
        else if (evt.target.style.borderTop == "") {
            evt.target.style.borderBottom = ''; evt.target.style.borderTop = '1px solid green';
        }
        else {
            console.log ("Wait. That's illegal."); console.log (evt.target)
        }
    }

    var all_p = document.querySelectorAll (".signal.sigval,.port.sigval")
    all_p.forEach (p => {
        if (p.parentElement.id.includes ("hz100"))  // do not touch hz100 because that must be a fixed clock... for now
            return
        else if (p.innerHTML == '&nbsp;') { // must be a single wave or a bit
            p.style.cursor = 'pointer'
            p.parentElement.onmousedown = (evt) => {
                bitToggle (evt)
                var p_elm = evt.target
                var bit_id_match = p_elm.parentElement.id.match (/^(.+)_([0-9]+)_([0-9]+)$/)

                if (!bit_id_match || bit_id_match.length < 4 || !bit_id_match[1] in multisignals) {
                    console.log ("Wait. That's illegal."); console.log (p.parentElement.id); console.log (bus_id_match); debugger;
                }

                if (!(bit_id_match[1] in window.wave.events [bit_id_match[3]]))
                    window.wave.events [bit_id_match[3]] [bit_id_match[1]] = '0'.repeat (parseInt (multisignals [bit_id_match[1]]))

                var newValue = (window.wave.events [bit_id_match[3]] [bit_id_match[1]].slice (0, parseInt (multisignals [bit_id_match[1]]) - parseInt (bit_id_match[2]) - 1)) + 
                               (!p_elm.style.borderBottom ? "1" : !p_elm.style.borderTop ? "0" : (() => { alert ("An error occurred while recalculating waveform values."); return 'err' })()) +
                               (window.wave.events [bit_id_match[3]] [bit_id_match[1]].slice (parseInt (multisignals [bit_id_match[1]]) - parseInt (bit_id_match[2])));

                document.querySelector ("#" + bit_id_match[1] + "_" + bit_id_match[3] + " p").innerHTML = window.busFormat == 'x' ? parseInt (newValue, 2).toString(16) : window.busFormat == 'b' ? newValue : parseInt (newValue, 2).toString()
                window.wave.events [bit_id_match[3]] [bit_id_match[1]] = newValue                           
            }
            
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
                        console.log ("Wait. That's illegal."); console.log (evt.target.parentElement.id); console.log (bus_id_match); debugger;
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
    try {
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
    document.getElementById ("waveidle").style.opacity = '0'
    setTimeout (() => {
        document.getElementById ("waveidle").style.display = 'none'
        Array.from (document.getElementById ("signalList").children).forEach (e => e.remove())
        initWaveform()
        drawWaveform(json)
    }, 300)
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

function toggleSignalPanel () {
    if (document.getElementById ("divSignalList").style.display == "flex") {
        document.getElementById ("divSignalList").style.opacity = 0
        document.getElementById ("divSignalList").style.display = "none"
    }
    else {
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

window.onbeforeunload = () => {
    window.localStorage.savedCode = window.codeEditor.getValue()
}

window.onload = () => {
    // document.documentElement.setAttribute ("theme", "light")
    // document.documentElement.setAttribute ("waveview", "true")

    document.getElementById ("waveforms").addEventListener ("DOMMouseScroll", horizontalResizeMouse)
    document.getElementById ("waveforms").addEventListener ("mousewheel", horizontalResizeMouse)

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
}
