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
            console.log (data)
            alert ("Error occurred: " + data.reason)
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
    Array.from (document.querySelectorAll (".sigval")).forEach (e => {
        e.style.width = (parseFloat (e.style.width.slice (0, e.style.width.indexOf ("v"))) + 0.2).toPrecision (2).toString() + "vw"
    })
    window.wave_width = Array.from (document.querySelectorAll (".sigval"))[0].style.width
    document.getElementById ("zoom_level").innerHTML = (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) + 5).toString() + "%"
}

function zoomOut () {
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
        else if (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) > 50) // down
            zoomOut ()
        e.preventDefault()
    }
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

    document.getElementById ("waveforms").addEventListener ("DOMMouseScroll", horizontalResizeMouse)
    document.getElementById ("waveforms").addEventListener ("mousewheel", horizontalResizeMouse)
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

function hideSignal (signal) {
    if (typeof signal == "object") {
        signal.forEach (sig => {
            document.getElementById (sig).style.display = "none"
            if (sig in multisignals) {
                for (var i = parseInt (multisignals [sig]) - 1; i > 0; i--) {
                    Object.keys (window.wave.events).map (e => (sig + "_" + i.toString() + "_" + e)).forEach (div_id => {
                        document.getElementById (div_id).style.display = "none"
                    })
                }
            }
            else {
                Object.keys (window.wave.events).map (e => (sig + "_" + e)).forEach (div_id => {
                    document.getElementById (div_id).style.display = "none"
                })
            }
        })
    }
    else if (typeof signal == "string") {
        if (!signal.includes ("_"))
            document.getElementById (signal).style.display = "none"
        if (signal in multisignals) {
            for (var i = parseInt (multisignals [signal]) - 1; i > 0; i--) {
                Object.keys (window.wave.events).map (e => (signal + "_" + i.toString() + "_" + e)).forEach (div_id => {
                    document.getElementById (div_id).style.display = "none"
                })
            }
        }
        else {
            Object.keys (window.wave.events).map (e => (signal + "_" + e)).forEach (div_id => {
                document.getElementById (div_id).style.display = "none"
            })
        }
    }
}

function showSignal (signal) {  
    if (typeof signal == "object") {
        signal.forEach (sig => {
            document.getElementById (sig).style.display = ""
            if (sig in multisignals) {
                for (var i = parseInt (multisignals [sig]) - 1; i > 0; i--) {
                    Object.keys (window.wave.events).map (e => (sig + "_" + i.toString() + "_" + e)).forEach (div_id => {
                        document.getElementById (div_id).style.display = ""
                    })
                }
            }
            else {
                Object.keys (window.wave.events).map (e => (sig + "_" + e)).forEach (div_id => {
                    document.getElementById (div_id).style.display = ""
                })
            }
        })
    }
    else if (typeof signal == "string") {
        if (!signal.includes ("_"))
            document.getElementById (signal).style.display = ""
        if (signal in multisignals) {
            for (var i = parseInt (multisignals [signal]) - 1; i > 0; i--) {
                Object.keys (window.wave.events).map (e => (signal + "_" + i.toString() + "_" + e)).forEach (div_id => {
                    document.getElementById (div_id).style.display = ""
                })
            }
        }
        else {
            Object.keys (window.wave.events).map (e => (signal + "_" + e)).forEach (div_id => {
                document.getElementById (div_id).style.display = ""
            })
        }
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
                sigdiv.addEventListener ('click', toggleSignal)
                var sigdivbox = document.createElement ("div")
                sigdivbox.classList.add ('signalPickBox')
                var sig_p = document.createElement ("p")
                sig_p.innerHTML = sig
                sig_p.style ['font-size'] = 'calc(0.65vw + 0.35vh)'
                sig_p.style.margin = 0
                sigdiv.appendChild (sigdivbox)
                sigdiv.appendChild (sig_p)
                allSignalList.appendChild (sigdiv)
            }
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
                    sigdiv.addEventListener ('click', toggleSignal)
                    var sigdivbox = document.createElement ("div")
                    sigdivbox.classList.add ('signalPickBox')
                    var sig_p = document.createElement ("p")
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
    if (waveforms.style ['justify-content'] == 'flex-start') { // already drawn, remove old waveforms and return
        Array.from (document.getElementsByClassName ("signaldiv")).slice (1).forEach (evt => evt.remove())
        return 
    }
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
