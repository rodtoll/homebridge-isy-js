# homebridge-isy-js
ISY-99 REST / WebSockets based HomeBridge platform. 

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
