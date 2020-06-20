const express = require ('express')
const app = express()
const cp = require ('child_process')
const fs = require ('fs')
const process = require ('process')
const crypto = require ('crypto')
const bodyParser = require('body-parser')
const rimraf = require('rimraf')
const geoip = require('geoip-lite'),
      server_log = function (req, res, next) {
                       ip_detail = geoip.lookup (req.ip)
                       var log = [
                            getTime(),
                            req.ip,
                            ip_detail ? (ip_detail.city + ', ' + ip_detail.country) : 'Unknown location',
                            req.method,
                            "demouser",
                            req.hostname,
                            req.originalUrl,
                            req.get('User-Agent')
                       ].join (' -- ')
                       next()
                   };

function debugLog (message) {
    console.log (getTime() + ": " + message)
}

function getTime()
{
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var min = (today.getMinutes() < 10 ? '0' + today.getMinutes() : today.getMinutes())
    var sec = (today.getSeconds() < 10 ? '0' + today.getSeconds() : today.getSeconds())
    var time = today.getHours() + ":" + min + ":" + sec;
    return (date + ' ' + time);
}

// Ensure that tools are installed
function which (command) {
    cmd = command.replace (/[^a-z0-9\-\_]+/g, '')
    return new Promise ((resolve, reject) => {
        try {
            cp.exec ("which " + cmd, (err, stdout, stderr) => {
                if (err) reject (err)
                else resolve (stdout)
            })
        }
        catch (err) {
            reject (err)
        }
    })
}

function rmRecursiveForce (path) {
    rimraf (path, (err) => {
        if (err) console.log (err)
    })
};

async function toolsExist() {
    try {
        await which ("verilator")
    }
    catch (err) {
        console.error ("Verilator doesn't seem to be installed. Run this script after you've installed Verilator.")
        process.exit()
    }
}
// toolsExist()

function validateVerilog(code) {
    return new Promise ((resolve, reject) => {
        if (!code.includes ('module top'))
            reject ({'status': 'failure', 'reason': 'Missing top module!'})
        else if (code == '')
            reject ({'status': 'failure', 'reason': 'No code received!'})
        else
            resolve ({'status': 'success'})
    })
}

if (process.env.ENABLERATELIMITING && process.env.ENABLERATELIMITING == '1') {
    const redis = require('redis');
    const redisClient = redis.createClient({ enable_offline_queue: false });

    const { RateLimiterRedis } = require('rate-limiter-flexible');
    const opts = {
        // Basic options
        storeClient: redisClient,
        points: 3, // Number of points
        duration: 1, // Per second(s)
        
        // Custom
        execEvenly: false, // Do not delay actions evenly
        blockDuration: 0, // Do not block if consumed more than points
        keyPrefix: 'rlflx', // must be unique for limiters with different purpose
    };
    
    const rateLimiterRedis = new RateLimiterRedis(opts);
    
    function rateLimiterMiddleware (req, res, next) {
        rateLimiterRedis.consume(req.ip)
        .then(() => { next() })
        .catch(() => {
            // Can't consume
            res.status(429).send('Too Many Requests');
        });
    }
}

app.use (server_log)
app.use (bodyParser.json());
app.use (require('sanitize').middleware)
app.use ('/assets', express.static (__dirname + '/assets'))
app.get ('/tests', (req, res) => {
    cp.exec ('ls ' + __dirname + '/tests/', (err, stdout, stderr) => {
        if (err) {
            console.error (err)
            console.error (stderr)
            return
        }
        res.send (stdout.split ("\n")
            .filter (e => e.includes (".cpp") && e.includes ("tb_") && !(e == 'tb_template.cpp'))
            .map (e => e.replace ('.cpp', '').replace ('tb_', ''))
        )
    })
})

app.post ('/writetest', rateLimiterMiddleware || (req, res, next => { next() }), (req, res) => {
    if (!(req.body.wave && req.body.testname)) {
        res.json ({'status': 'failure', 'reason': 'No wave data received.'})
    }
    else {
        wave = req.body.wave
        name = req.body.testname
        fs.readFile ('tests/tb_template.cpp', null, (err, data) => {
            data = data.toString()
            if (err) { console.error (err); res.json ({'status': 'failure', 'reason': 'Error opening template.'}); return }
            var testbench = []
            Object.keys (wave.events).forEach (time => {
                testbench.push ("\r\n    main_time++;")
                Object.keys (wave.events [time]).forEach (signal => {
                    testbench.push ("    top->" + signal + " = 0b" + wave.events [time][signal] + ";")
                })
                testbench.push ("\r\n    top->eval();\r\n")
            })
            fs.writeFile ('tests/tb_' + name + '.cpp', data.replace ('/*<<TEMPLATEMARK>>*/', testbench.join ('\r\n')), (err) => {
                if (err)
                    res.json ({'status': 'failure', 'reason': 'Unable to save testbench file.'})
                else
                    res.json ({'status': 'success', 'test': name})
            })
        })
    }
})

app.post ('/simulate', rateLimiterMiddleware || (req, res, next => { next() }), (req, res) => {
    // get code
    validateVerilog (req.body.code)
    .then (result => {
        if (result.status == 'success') {
            // create random uuid
            uuid = crypto.createHash ('sha256').update (req.body.code).update (new Date ().toString()).digest ("hex");
            fs.mkdirSync ('/tmp/' + uuid)
            fs.writeFileSync ('/tmp/' + uuid + '/code.v', req.body.code)

            // verilate
            try {
                test = req.body.test.match ("[a-z0-9_]+")[0]
                out = cp.execSync ('verilator --build --cc --exe --top-module tb_top --trace ' + __dirname + '/tb_top.v code.v ' + __dirname + 
                                   '/tests/tb_' + test + '.cpp',
                                   {cwd: '/tmp/' + uuid})
            }
            catch (err) {
                rmRecursiveForce ('/tmp/' + uuid)
                res.json ({'status': 'failure', 'reason': {'stderr': err.toString().split ("\n").slice (1).join ('\n')}})
                return
            }
            // execute
            try {
                console.log ("Running simulation...")
                out = cp.execSync ('obj_dir/Vtb_top', {cwd: '/tmp/' + uuid})
            }
            catch (err) {
                rmRecursiveForce ('/tmp/' + uuid)
                res.json ({'status': 'failure', 'reason': {'stderr': err.toString().split ("\n").slice (1).join ('\n')}})
                return
            }
            
            // Print top.vcd
            console.log ("Reading VCD...")
            cp.exec ('cat trace/top.vcd', {cwd: '/tmp/' + uuid}, (err, stdout, stderr) => {
                // missing?
                rmRecursiveForce ('/tmp/' + uuid)
                if (err) {
                    res.json ({'status': 'failure', 'reason': "No top.vcd file was found."})
                }
                // else send contents of vcd
                else {
                    res.json ({'status': 'success', 'vcd': stdout})
                }
            })
        }
        else {
            res.send (result)
        }
    })
    .catch (result => {
        res.send (result)
    })
})

app.get ('*/', (req, res) => {
    res.sendFile (__dirname + "/index.html")
})

if (!module.parent) {
    app.listen (8000, '0.0.0.0')
}

module.exports = app
