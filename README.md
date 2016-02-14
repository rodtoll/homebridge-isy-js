# homebridge-isy-js [![Build Status](https://api.travis-ci.org/rodtoll/homebridge-isy-js.svg?branch=master)](https://api.travis-ci.org/rodtoll/isy-js.svg?branch=master)
ISY-99 REST / WebSockets based HomeBridge platform. 

NOTE: Homebridge-isy-js now includes support for garage door openers. Make sure you ensure a garage door is clear before closing it.

Supports the following Insteon devices: Lights (dimmable and non-dimmable), Fans, Outlets, Door/Window Sensors, MorningLinc locks, Inline Lincs, Motion Sensors and I/O Lincs.
Also supports ZWave based locks. If elkEnabled is set to true then this will also expose your Elk Alarm Panel and all of your Elk Sensors. 

Turns out that HomeBridge platforms can only return a maximum of 100 devices. So if you end up exposing more then 100 devices through HomeBridge the HomeKit
software will fail adding the HomeBridge to your HomeKit network. To address this issue this platform provides an option to screen out devices based on 
criteria specified in the config. 

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-isy-js
3. Update your configuration file. See sampleconfig.json in this repository for a sample. 

# Configuration

Configuration sample:

 ```
     "platforms": [
        {
            "platform": "isy-js",
            "name": "isy-js",         
            "host": "10.0.1.12",      
            "username": "admin",      
            "password": "password",   
            "elkEnabled": true,       
            "useHttps": false,
            "debugLoggingEnabled": false,
            "includeAllScenes": false,
            "includedScenes": [
                "27346"
            ],
            "garageDoors": [
                { "address": "17 79 81 1", "name": "Garage Door", "timeToOpen": 12000 }
            ],
            "ignoreDevices": [        
                { "nameContains": "ApplianceLinc", "lastAddressDigit": "", "address": ""},
                { "nameContains": "Bedroom.Side Gate", "lastAddressDigit": "", "address": ""},
                { "nameContains": "Remote", "lastAddressDigit": "", "address": "" },    
                { "nameContains": "Keypad", "lastAddressDigit": "2", "address": "" },
            ]
        }
     ]
```

Fields: 
* "platform" - Must be set to isy-js
* "name" - Can be set to whatever you want
* "host" - IP address of the ISY
* "username" - Your ISY username
* "password" - Your ISY password
* "elkEnabled" - true if there is an elk alarm panel connected to your ISY
* "useHttps" - true if you want to use a https connection to the ISY. Only use if you have HTTPS setup with a proper cert.
* "debugLoggingEnabled" - true if you want debug logs to be dumped to the console.
* "garageDoors" - Specifies a list of devices which are I/O Lincs which should be treated as a garage door opener by HomeKit. The entry takes the form of one entry per device. (NOTE: In ISY an IO Linc is treated as two devices, you only need one entry for each IO Linc).
Each entry should have the following elements: "address" - the address of the IO Linc primary device (the .1 device), "name" - Name to give the garage door device, "timeToOpen" - The number of ms before a door which is opening should be considered open.
* "includeAllScenes" - true if you want the platform to expose all the scenes. Setups usually have a LOT of scenes any only 100 devices are supported from a bridge. It is recommended you proactively include the scenes you want in includedScenes.
* "includedScenes" - An array of the addresses of the scenes you want to include as lighting devices.
* "ignoreDevices" - Array of objects specifying criteria for screening out devices from the network. nameContains is the only required criteria. If the other criteri are blank all devices will match those criteria (providing they match the name criteria).
* (Under ignoreDevices) "nameContains" - Specifies a substring to check against the names of the ISY devices. Required field for the criteria.
* (Under ignoreDevices) "lastAddressDigit" - Specifies a single digit in the ISY address of a device which should be used to match the device. Example use of this is for composite devices like keypads so you can screen out the non-main buttons. 
* (Under ignoreDevices) "address" - ISY address to match.		   
     
```    
Examples:

{ "nameContains": "Keypad", "lastAddressDigit": "2", "address": "" } - Ignore all devices which have the word Keypad in their name and whose last address digit is 2.
{ "nameContains": "Remote", "lastAddressDigit": "", "address": "" } - Ignore all devices which have the word Remote in their name
{ "nameContains": "", "lastAddressDigit": "", "address": "15 5 3 2"} - Ignore the device with an ISY address of 15 5 3 2.
```

# Implementation Notes

* Scenes will not show as on until all light devices are on. This allows the UI to send an 'on' request to light up the rßest of them.
* Garage door openers (in this case an I/O Linc used in a garage kit) are complex to get correct. We only have the current state of the contact
 sensor to determine current status. In particular, if you startup the system while the garage door is changing state (opening or closing)
 the code will likely get the state incorrect. If you get into this state, close the garage door and restart homebridge. The garage door is assumed open at startup and closed at startup if the contact sensor
 says the door is open or closed respectively.

 # History

 * 0.1.4 - Release for testing alternative garage logic. No change for anyone wanting to use it with the standard logic.
 * 0.1.3 - Added improved debug output. Fixed bug where plugin would crash when there are no garage door opener present.
 * 0.1.2 - Added garage door opener support
 * Previous - Changes not tracked in this document.