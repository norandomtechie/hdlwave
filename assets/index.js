window.addEventListener ("message", (event) => {
    console.log (event.origin)
    console.log (event.message)
})

// Register event handlers
document.getElementById ("darkmode").addEventListener ("change", () => {
    document.documentElement.setAttribute ("theme", document.getElementById ("darkmode").checked ? "dark" : "light")
    if (window.codeEditor) {
        window.codeEditor.resize()
        window.codeEditor.setTheme (document.getElementById ("darkmode").checked ? "ace/theme/chaos" : "ace/theme/chrome")
    }
    
})

// document.getElementById ("waveview").addEventListener ("change", () => {
//     document.documentElement.setAttribute ("waveform", document.getElementById ("waveview").checked ? "true" : "false")
//     if (window.codeEditor)
//         window.codeEditor.resize()
// })

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

document.getElementById ("btn_simulate").addEventListener ("click", () => {
    // if (!window.codeEditor.getValue().includes ("$dumpfile") || !window.codeEditor.getValue().includes ("$dumpvars")) {
    //     alert ("To be able to view traces, you will need to include the necessary $dumpfile/$dumpvars directives.  Read the help page to learn how to do this.")
    //     return
    // }
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
        }
        else {
            console.log (data)
            alert ("Error occurred: " + data.reason)
        }
    })
})

const signals = [
    "hz100", "reset", "pb", 
    "ss7", "ss6", "ss5", "ss4", "ss3", "ss2", "ss1", "ss0", 
    "left", "right", "red", "green", "blue", 
    "txdata", "txclk", "txready", "rxdata", "rxclk", "rxready"
]

const multisignals = {  // multibits
    "pb": 21,
    "ss7": 8, "ss6": 8, "ss5": 8, "ss4": 8, "ss3": 8, "ss2": 8, "ss1": 8, "ss0": 8,
    "left": 8, "right": 8,
    "txdata": 8, "rxdata": 8
}

function vcdToJSON (vcd) {
    wave = {}
    wave.version = vcd.match (/\$version *([^\n$]+)\n* *\$end/)[1].trim()
    wave.date = vcd.match (/\$date *([^\n$]+)\n* *\$end/)[1].trim()
    wave.timescale = vcd.match (/\$timescale *([^\n$]+)\n* *\$end/)[1].trim()
    
    wave.signal_map = {}
    signals.forEach (port => {
        wave.signal_map [vcd.match (new RegExp ("var wire +[0-9]+ +(.) +" + port + "[^\$]+.end"))[1]] = port
    })
    
    wave.events = {}
    var vcdlines = vcd.split ("\n"),
        eventStart = vcdlines.indexOf ("#1"),
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

function zoomIn (evt) {
    Array.from (document.querySelectorAll (".sigval")).forEach (e => {
        e.style.width = (parseFloat (e.style.width.slice (0, e.style.width.indexOf ("v"))) + 0.2).toPrecision (2).toString() + "vw"
    })
    window.wave_width = Array.from (document.querySelectorAll (".sigval"))[0].style.width
    document.getElementById ("zoom_level").innerHTML = (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) + 5).toString() + "%"
}

function zoomOut (evt) {
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
            zoomIn (e)
        else if (parseInt (document.getElementById ("zoom_level").innerHTML.match (pc_re)[1]) > 50) // down
            zoomOut (e)
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

function resizeHandler (e) {
    resizer = document.getElementById ("resizer")
    if (e.type == "mousemove" && resizer.classList.contains ('dragging'))
        console.log (e)
    else if (e.type == "mousedown")
        resizer.classList.add ('dragging')
    else if (e.type == "mouseup")
        resizer.classList.remove ('dragging') 
}

function drawWaveform (wave) {
    sig_to_val = {}
    Object.keys (wave.events).forEach ((time) => {
        var signaldiv = document.createElement ("div")
        var waveforms = document.getElementById ("waveforms")
        signaldiv.classList = ["signaldiv"] 

        signals.forEach (sig => {
            signal = document.createElement ("div")
            signal.style.width = window.wave_width
            signal.classList.add ('sigval')
            signal.id = sig + '_' + time.toString()
            sigtext = document.createElement ("p") 
            sigtext.classList.add ('signal', 'sigval')
            sigtext.style.width = window.wave_width
            sigtext.style ['text-align'] = 'center'
            if (sig in multisignals && sig in wave.events [time]) {
                sigtext.innerHTML = parseInt (wave.events [time][sig], 2).toString()
            }
            else if (sig in multisignals) {
                sigtext.innerHTML = sig_to_val [sig]
            }
            else if (sig in wave.events [time]) {
                sigtext.innerHTML = wave.events [time][sig]
            }
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
                // sigtext.style.borderBottom = "1px solid green"
            }
            if (!(sig in multisignals))
                sigtext.innerHTML = "&nbsp;"
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
                port.id = signal + "[" + i.toString() + "]"
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
            }
            bus.appendChild (portlist)
        })
    })

    for (var j = 0; j <= 138; j++) {
        for (var i = 1; i < Object.keys (wave.events).length; i++) {
            nextWave = document.querySelectorAll (".signaldiv")[i + 1].querySelectorAll (".port,.signal")[j]
            currentWave = document.querySelectorAll (".signaldiv")[i].querySelectorAll (".port,.signal")[j]
            if ((!nextWave.style.borderTop && currentWave.style.borderTop) || (nextWave.style.borderTop && !currentWave.style.borderTop)) {
                currentWave.style.borderRight = "1px solid green"
            }
        }
    }
}

function initWaveform() {
    var waveforms = document.getElementById ("waveforms")
    var waveviewer = document.getElementById ("waveviewer")
    if (waveforms.style ['justify-content'] == 'flex-start') {
        Array.from (document.getElementsByClassName ("signaldiv")).slice (1).forEach (evt => evt.remove())
        return // already drawn, remove old waveforms
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
    signaldiv.style ['margin-right'] = '0.5vw'

    signals.forEach (sig => {
        signal = document.createElement ("div")
        signal.classList.add ('signame')
        signal.style.width = window.wave_width
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
                    for (var t = 1; t < Object.keys (window.wave.events).length + 1; t++) {
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
            port.id = signal + "[" + i.toString() + "]"
            sigtext = document.createElement ("p") 
            sigtext.classList.add ('port')
            sigtext.style ['margin-right'] = "0.5vw"
            sigtext.innerHTML = signal + "[" + i.toString() + "]"
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
    document.getElementById ("overlay").style.opacity = '0'
    setTimeout (() => { document.getElementById ("overlay").style.display = 'none' }, 500)
}
