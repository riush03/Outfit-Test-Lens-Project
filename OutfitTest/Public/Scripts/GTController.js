// -----JS CODE-----
// GTController.js
// Version: 0.0.1
// Event: On Awake
// Description: A controller script that manages the Garment Transfer Custom Component
// Allows selecting between 3 different run modes, implements photo mode (Run on Tap)
// Sets the currently active garment image that is selected in the carousel

//@input int runMode = 1 {"widget":"combobox", "values":[{"label":"Adapt to Device Performance", "value":1}, {"label":"Run Always", "value":2}, {"label":"Run on Tap", "value":3}]}
//@input Component.ScriptComponent gt
//@input Asset.Texture snapshotImage
//@input bool advanced
//@input SceneObject photoButton { "showIf": "advanced" }
//@input SceneObject resetButton { "showIf": "advanced" }

// Constants for button "hey" animation
const btnAnimStart = 0.7*Math.PI;
const btnAnimSpeed = 20;
const btnAnimScaleInc = 0.15;

// If using `Adapt to Device Performance` mode and 
// current device's ML performance index is less 
// than this value, Lens will use `Run on Tap` mode.
var lowMLPerformanceIndexBreakpoint = 7;
var runLive;
var animationTimer = 0;

function shouldDeviceRunLive() {
    if (global.deviceInfoSystem.isEditor()) {
        return true;
    }

    // Represents the device's ML performance.
    // The higher the number, the faster the performance.
    // As of April 2020, the range of index is (0 - 8).
    // As more performant device become available, the maximum index will increase.
    if (global.deviceInfoSystem.performanceIndexes.ml>=lowMLPerformanceIndexBreakpoint) {
        return true;
    }

    return false;
}

function init() {
    if (!checkAllInputSet()) {
        return;
    }
    
    runLive = (script.runMode==1) ? shouldDeviceRunLive() : (script.runMode==2) ? true: false;
    if (runLive) {
        // Live mode
        script.gt.autoRun = true;
    } else {
        // Photo mode
        script.gt.autoRun = false;
        script.gt.enabled = false;
        script.photoButton.enabled = true;

        // register for photo touch events
        script.photoButton.getComponent("Component.InteractionComponent").onTap.add(function() {
            // Take photo
            var photo = script.snapshotImage.copyFrame();
            script.gt.targetImage = photo;

            // Call generate manually
            script.gt.run();
            script.gt.enabled = true;
            script.photoButton.enabled = false;
            script.resetButton.enabled = true;
        });
        script.resetButton.getComponent("Component.InteractionComponent").onTap.add(function() {
            // Back to camera
            script.gt.enabled = false;
            script.photoButton.enabled = true;
            script.resetButton.enabled = false;
        });
    }
}

function checkAllInputSet() {
    if (!script.gt) {
        print("error: Please assign garment transfer custom component input");
        return false;
    }

    if (!script.photoButton) {
        print("error: Please assign photo button scene object");
        return false;
    }

    if (!script.photoButton.getComponent("Component.InteractionComponent")) {
        print("error: Please add Interaction component to photo button");
        return false;
    }

    if (!script.resetButton) {
        print("error: Please assign reset button scene object");
        return false;
    }

    if (!script.resetButton.getComponent("Component.InteractionComponent")) {
        print("error: Please add Interaction component to reset button");
        return false;
    }

    return true;
}

script.setGarment = function(i, tex) {
    script.gt.garmentImage = tex;
    if (!runLive) {
        // Run the transfer manually in photo mode
        if (script.gt.enabled && !script.gt.autoRun) {
            script.gt.run();
        } else {
            animationTimer = btnAnimStart;
        }
    }
};

function animatePhotoButton() {
    const st = script.photoButton.getComponent("Component.ScreenTransform");
    if (animationTimer>0) {
        animationTimer -= btnAnimSpeed*getDeltaTime();
        if (animationTimer<=0) {
            animationTimer = 0;
        }
        const s = 1 + btnAnimScaleInc*Math.sin(animationTimer);
        st.scale = new vec3(s,s,1);
    }
}

script.createEvent("OnStartEvent").bind(function() {
    init();
});

script.createEvent("UpdateEvent").bind(function() {
    animatePhotoButton();
});
