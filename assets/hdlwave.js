class HDLwave {
    constructor(hostDiv, options) {
        this.hostDiv = hostDiv  
        this.options = options
        this.drawBoard()
    }
    modTimeCol (opt=0) {
        switch (opt) {
            case 0: 
                this.options.signals.forEach (signal => {
                    var waverow = document.getElementById ("waverow/" + signal)
                    this.addUnitToWaverow (waverow, signal, this.options.resolution, 'logic0')
                })
                this.options.resolution++
                break;
            case 1:
                this.options.signals.forEach (signal => {
                    document.getElementById (signal + "/" + (this.options.resolution - 1)).remove()
                })
                this.options.resolution--
                break;
        }
    }
    toggleEvent (e) {
        e.preventDefault()

        function pullSignalByEvent (e, opt=0) {
            if (opt == 0) {
                e.target.classList.remove ('logicZ')
                e.target.classList.remove ('logicX')
                e.target.classList.remove ('logic1')
                e.target.classList.add ('logic0')
            }
            else if (opt == 1) {
                e.target.classList.remove ('logicZ')
                e.target.classList.remove ('logicX')
                e.target.classList.remove ('logic0')
                e.target.classList.add ('logic1')
            }
            else if (opt == 'X') {
                e.target.classList.remove ('logic1')
                e.target.classList.remove ('logic0')
                e.target.classList.remove ('logicZ')
                e.target.classList.add ('logicX')
            }
            else if (opt == 'Z') {
                e.target.classList.remove ('logic1')
                e.target.classList.remove ('logic0')
                e.target.classList.remove ('logicX')
                e.target.classList.add ('logicZ')
            }
            else {
                throw "opt value was not valid."
            }
        }

        if (e.type == 'mousedown') { window.dragToggle = true }
        else if (e.type == 'mouseenter' && !window.dragToggle) { return }
        
        if (e.shiftKey) { pullSignalByEvent (e, 0); return }
        else if ((e.ctrlKey || e.metaKey)) { pullSignalByEvent (e, 1); return }

        if (window.signalMetastable) { pullSignalByEvent (e, 'X'); return }
        if (window.signalDisconnect) { pullSignalByEvent (e, 'Z'); return }

        if (!e.target.classList.contains ('logic1')) {
            pullSignalByEvent (e, 1)
        }
        else if (!e.target.classList.contains ('logic0')) {
            pullSignalByEvent (e, 0)
        }
    }
    addUnitToWaverow (waverow, signal, time, cssClass) {
        var unit = document.createElement ("div")
        unit.classList.add ('event', cssClass)
        
        unit.id = [signal, time].join ('/')
        if (!Object.keys (this.options.inputs).includes (signal)) {
            unit.addEventListener ('mousedown', this.toggleEvent)
            unit.addEventListener ('mouseenter', this.toggleEvent)
        }
        waverow.appendChild (unit)
    }
    drawBoard () {
        function optionsAreValid (options) {
            return ['inputs', 'outputs'].map (opt => opt in options).reduce ((prev, curr) => prev && curr, true)
        }
        function findMaxResolution (options) {
            var bitstreams = Object.values (options.inputs).concat (Object.values (options.outputs))
            var maxBits = 0
            bitstreams.forEach (bs => { maxBits = maxBits < bs.length ? bs.length : maxBits })
            return maxBits
        }
        var maxchars = 0;
        if (!optionsAreValid (this.options)) {
            throw "Error in initialization: required at least 2 options - " +
                  "input and output signals with bitstreams and associated field elements."
        }
        else {
            try {
                var inputs = Object.keys (this.options.inputs)
                var outputs = Object.keys (this.options.outputs)
                var signals = inputs.concat (outputs)
                this.options.signals = signals
                var resolution = this.options.resolution || findMaxResolution(this.options)
                if (!this.options.resolution) {
                    this.options.resolution = resolution
                }
                var clock = this.options.clock || []
                var rate = this.options.rate || (this.options.clock && this.options.clock.length > 0 ? 
                                                 "4".repeat (this.options.clock.length).split ("") 
                                                 : [])
                var fixed = this.options.fixed || []
                var scale = this.options.scale || '5ns'
                var modifyLength = 'modifyLength' in this.options ? this.options.modifyLength : 'true'
            }
            catch (err) {
                console.error ("Some options were missing!")
                console.error (err)
            }
        }

        document.body.onmouseup = () => { window.dragToggle = false }
        document.body.ondragend = () => { window.dragToggle = false }
        document.body.onkeydown = (e) => {
            var lastIndex = document.getElementById ('activeval').innerHTML.lastIndexOf (';')
            if (e.key.match (/z/i)) {
                window.signalDisconnect = true
                document.getElementById ('activeval').innerHTML = document.getElementById ('activeval').innerHTML.slice (0, lastIndex + 1) + 'Z'
                return
            }
            else if (e.key.match (/x/i)) {
                window.signalMetastable = true
                document.getElementById ('activeval').innerHTML = document.getElementById ('activeval').innerHTML.slice (0, lastIndex + 1) + 'X'
                return
            }
            if (e.shiftKey) {
                document.getElementById ('activeval').innerHTML = document.getElementById ('activeval').innerHTML.slice (0, lastIndex + 1) + '0'
                return
            }
            else if (e.ctrlKey || e.altKey) {
                document.getElementById ('activeval').innerHTML = document.getElementById ('activeval').innerHTML.slice (0, lastIndex + 1) + '1'
                return
            }
        }
        document.body.onkeyup = (e) => {
            window.signalMetastable = false
            window.signalDisconnect = false
            var lastIndex = document.getElementById ('activeval').innerHTML.lastIndexOf (';')
            document.getElementById ('activeval').innerHTML = document.getElementById ('activeval').innerHTML.slice (0, lastIndex + 1) + 'N'
        }

        var waverow = document.createElement ("div")
        waverow.classList.add ('waverow')
        waverow.id = 'waverow/settings'

        // Timescale view
        var timep = document.createElement ("p")
        timep.innerHTML = 'Timescale:&nbsp;&nbsp;'
        waverow.appendChild (timep)
        var timescale = document.createElement ("div")
        timescale.classList.add ('event')
        timescale.style.border = '2px solid green'
        timescale.style.borderRadius = '5px'
        timescale.style.marginRight = '15px'
        timescale.innerHTML = '<p>' + scale + '</p>'
        waverow.appendChild (timescale)
        
        // Add/remove waves
        if (modifyLength) {
            var addbtn, subbtn;
            [addbtn, subbtn] = [document.createElement ("div"), document.createElement ("div")]
            addbtn.classList.add ('btn');  subbtn.classList.add ('btn')
            addbtn.innerHTML = '<p class="unselectable" style="font-size: 22px">+</p>'
            subbtn.innerHTML = '<p class="unselectable" style="font-size: 24px">-</p>'
            addbtn.id = 'add'; subbtn.id = 'sub'
            addbtn.addEventListener ('click', () => { this.modTimeCol (0) }); subbtn.addEventListener ('click', () => { this.modTimeCol (1) })
            subbtn.style.marginRight = '15px'
            var wavemod = document.createElement ("p")
            wavemod.innerHTML = 'Modify waveform time:&nbsp;&nbsp;'
            waverow.appendChild (wavemod)
            waverow.appendChild (addbtn)
            waverow.appendChild (subbtn)
        }

        // Active value
        var activeVal = document.createElement ("p")
        activeVal.id = 'activeval'
        activeVal.innerHTML = 'Forcing value:&nbsp;&nbsp;N'
        waverow.appendChild (activeVal)
        
        this.hostDiv.appendChild (waverow)

        signals.forEach (signal => { if (signal.length > maxchars) { maxchars = signal.length } })
        signals.forEach (signal => {
            waverow = document.createElement ("div")
            waverow.classList.add ('waverow')
            waverow.id = 'waverow/' + signal

            var name = document.createElement ("p")
            name.innerHTML = signal
            name.id = "name/" + signal
            name.style.width = (maxchars * 8 + 15) + 'px'
            
            waverow.appendChild (name)
            for (var i = 0; i < resolution; i++) {
                var value = Object.keys (this.options.inputs).includes (signal) ?
                            (this.options.inputs [signal][i] || '0').match (/1/i) ? 'logic1' :
                            (this.options.inputs [signal][i] || '0').match (/0/i) ? 'logic0' :
                            (this.options.inputs [signal][i] || '0').match (/Z/i) ? 'logicZ' : 'logicX' :
                            'logic0'
                this.addUnitToWaverow (waverow, signal, i, value)
            }
            this.hostDiv.appendChild (waverow)
        })
    }
}