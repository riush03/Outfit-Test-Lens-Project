// Carouse2D.js
// Version 1.0.0
// Provides a dynamic carousel ui widget for the selection of one item between many
// Event - OnAwake
// 
// When selection is made the 'callbackFuncName' function of the script 'callbackScript' will be called

//@input Asset.Texture[] icons

//@ui {"widget":"group_start", "label":"On Item Set Call", "hint" : "Will call your_script.your_func_name(index, icon_texture)"}
//@input Component.ScriptComponent callbackScript {"label" : "Script"}
//@input string callbackFuncName {"label" : "Function Name", "hint" : "Will call your_script.your_func_name(index, icon_texture)"}
//@ui {"widget":"group_end"}

//@ui {"widget":"separator"}

//@ui {"widget":"group_start", "label":"Look"}
//@input float itemSize {"widget": "slider", "min": 0.2, "max": 5.0, "step": 0.01}
//@input float carouselRadius {"widget": "slider", "min": 0.2, "max": 6.0, "step": 0.01}
//@input vec4 backgroundColor {"widget": "color"}
//@ui {"widget":"group_end"}

//@input bool advanced

//@ui {"widget":"group_start", "label":"Look", "showIf": "advanced"}
//@input float ringMargin {"widget": "slider", "min": 0, "max": 2.0, "step": 0.01, "showIf": "advanced"}
//@input Asset.Material itemMaterial {"showIf": "advanced"}
//@input Asset.Material ringMaterial {"showIf": "advanced"}
//@input Asset.Material bgMaterial {"showIf": "advanced"}
//@input int baseRenderOrder {"label": "Render Order", "showIf": "advanced"}
//@ui {"widget":"group_end", "showIf": "advanced"}

//@ui {"widget":"group_start", "label":"Feel", "showIf": "advanced"}
//@input float touchSensitivity {"showIf": "advanced", "widget": "slider", "min": 1, "max": 14, "step": 0.25}
//@input float magnetForce {"showIf": "advanced", "widget": "slider", "min": 0.3, "max": 0.9, "step": 0.1}
//@input float inertiaForce {"showIf": "advanced", "widget": "slider", "min": 0, "max": 1, "step": 0.1}
//@input float delayCallback {"showIf": "advanced"}
//@ui {"widget":"group_end"}

var NUMICONS = 5;

var items = [];
var ring = {
    st: null,
    img: null,
    mat: null,
    open: 0,
    openTarget: 0
};
var touching = false;
var lastTouch = {
    pos: new vec2(0, 0),
    time: 0,
    speed: 0
};
var currentIndex = 0;
var currentAng = 0, targetAng = 0;
var forwardIndex, backwardIndex;
var lastIndexSet = -1;

function map(input, inputMin, inputMax, outputMin, outputMax, clamp) {
    input = (input - inputMin) / (inputMax - inputMin);
    var output = input * (outputMax - outputMin) + outputMin;
    if (clamp) {
        if (outputMax < outputMin) {
            if (output < outputMax) {
                output = outputMax;
            } else if (output > outputMin) {
                output = outputMin;
            }
        } else {
            if (output > outputMax) {
                output = outputMax;
            } else if (output < outputMin) {
                output = outputMin;
            }
        }
    }
    return output;
}

function tapOnItemFunction(i) {
    return function(args) {
        setCenteredItem(i);
    };
}

function init() {
    // Create items root and items scene objects
    const so = script.getSceneObject();
    // Create selection ring
    const ringParent = global.scene.createSceneObject("SelectionRingParent");
    ringParent.setParent(so);
    const ringSo = global.scene.createSceneObject("SelectionRing");
    ringSo.setParent(ringParent);
    ringSo.setRenderLayer(so.getRenderLayer());
    ring.st = ringSo.createComponent("Component.ScreenTransform");
    ring.mat = script.ringMaterial.clone();
    ring.img = ringSo.createComponent("Component.Image");
    ring.img.clearMaterials();
    ring.img.addMaterial(ring.mat);
    ring.img.stretchMode = StretchMode.Fit;
    ring.img.setRenderOrder(script.baseRenderOrder + NUMICONS + 1);

    // Create items root
    const root = global.scene.createSceneObject("Items");
    root.setParent(so);
    root.setRenderLayer(so.getRenderLayer());

    // If only one icon was set, display only one item in the carousel and disable interaction
    if (script.icons.length < 2) {
        NUMICONS = 1;
    }

    // Setup carousel items
    for (var i = 0; i < NUMICONS; i++) {
        const c = global.scene.createSceneObject("Item" + i);
        c.setParent(root);
        c.setRenderLayer(so.getRenderLayer());
        const st = c.createComponent("Component.ScreenTransform");
        const img = c.createComponent("Component.Image");
        img.clearMaterials();
        img.addMaterial(script.itemMaterial.clone());
        const inter = c.createComponent("Component.InteractionComponent");
        items.push({
            st: st,
            img: img,
            ang: 0,
            prevAng: 0
        });
        inter.onTap.add(tapOnItemFunction(i));
    }

    // Assign initial icons to visible items
    if (script.icons.length > 0) {
        forwardIndex = -1;
        backwardIndex = script.icons.length;
        const half = 0.5 * items.length;
        for (i = 0; i < half; i++) {
            forwardIndex = (forwardIndex + 1) % script.icons.length;
            items[i].img.mainPass.baseTex = script.icons[forwardIndex];
            items[i].contentIndex = forwardIndex;
            items[i].content = script.icons[forwardIndex];
        }
        for (i = items.length - 1; i > half; i--) {
            backwardIndex--;
            if (backwardIndex < 0) {
                backwardIndex = script.icons.length - 1;
            }
            items[i].contentIndex = backwardIndex;
            items[i].content = script.icons[backwardIndex];
            items[i].img.mainPass.baseTex = items[i].content;
        }
    }

    setCenteredItem(0);
    updateItems(1, true);

    // Setup carousel interaction
    const carouselUIArea = so.createComponent("Component.Image");
    carouselUIArea.addMaterial(script.bgMaterial.clone());
    carouselUIArea.getMaterial(0).mainPass.baseColor = script.backgroundColor;
    carouselUIArea.setRenderOrder(script.baseRenderOrder);
    if (NUMICONS > 1) {
        const carouselUI = so.createComponent("Component.InteractionComponent");
        carouselUI.onTouchStart.add(function(touch) {
            touching = true;
            lastTouch.pos.x = touch.position.x;
            lastTouch.pos.y = touch.position.y;
            lastTouch.time = getTime();
            lastTouch.speed = 0;
            ring.openTarget = 1;
        });
        carouselUI.onTouchMove.add(function(touch) {
            const offt = touch.position.x - lastTouch.pos.x;
            targetAng += script.touchSensitivity * offt;
            lastTouch.pos.x = touch.position.x;
            lastTouch.pos.y = touch.position.y;
            const t = getTime();
            if (t - lastTouch.time > 0) {
                const fs = offt * (1 / (t - lastTouch.time));
                lastTouch.speed += 0.6 * (fs - lastTouch.speed);
            }
            lastTouch.time = t;
            updateItems(1);
        });
        carouselUI.onTouchEnd.add(function(touch) {
            touching = false;
            if (items.length < 1) {
                return;
            }

            targetAng += script.inertiaForce * lastTouch.speed;
            snapToClosest();
        });
    }
}

script.createEvent("UpdateEvent").bind(function() {
    if (!touching) {
        updateItems(script.magnetForce);
    }
});

function updateItems(alpha, force) {
    if (items.length < 1) {
        return;
    }

    const angStep = 2 * Math.PI / items.length;

    // Animate selection ring
    ring.open += 0.6 * (ring.openTarget - ring.open);
    const ringScale = 1 + 0.4 * ring.open;
    const ringAlpha = 1 - 0.4 * ring.open;
    ring.st.anchors.setSize(new vec2(ringScale * (script.itemSize + script.ringMargin), ringScale * (script.itemSize + script.ringMargin)));
    ring.mat.mainPass.alpha = ringAlpha;

    // Calculate offset from target angle to current angle
    var offset = minusPItoPI(targetAng - currentAng);
    // Scale down ring selector if offset is close to 0
    if (!touching && Math.abs(offset) < 0.3) {
        ring.openTarget = 0;
    }

    // Stop animation if selected item is centered
    if (!force && Math.abs(offset) < 0.00001) {
        return;
    }

    // If almost centered, center completely and call setItem function
    // Else animate into position
    if (!touching && Math.abs(offset) < 0.05) {
        currentAng = targetAng;
        if (currentIndex != lastIndexSet) {
            setDelayedAction(script.delayCallback, function() {
                if (script.callbackScript && script.callbackFuncName) {
                    if (script.callbackScript[script.callbackFuncName]) {
                        script.callbackScript[script.callbackFuncName](items[currentIndex].contentIndex, items[currentIndex].content);
                    } else {
                        print("error: cannot find function '" + script.callbackFuncName + "' in script");
                    }
                }
            });
            lastIndexSet = currentIndex;
        }
    } else {
        currentAng += alpha * (offset);
    }

    // Set items position, size, and render order
    for (var i = 0; i < items.length; i++) {
        const item = items[i];
        const st = item.st;
        item.prevAng = item.ang;
        item.ang = zeroTo2PI(currentAng + i * angStep);
        const p = quat.angleAxis(item.ang, new vec3(0, 1, 0)).multiplyVec3(new vec3(0, 0, script.carouselRadius));
        const normZ = p.z / script.carouselRadius;
        const size = normZ < 0 ? 0 : Math.sqrt(normZ);
        st.anchors.setCenter(new vec2(p.x, 0));
        st.anchors.setSize(new vec2(script.itemSize * size, script.itemSize * size));
        item.img.setRenderOrder(script.baseRenderOrder + NUMICONS * size);
        item.img.mainPass.alpha = map(normZ, 0, 0.1, 0, 1, true);

        // Replace icons
        const pbackdist = item.prevAng - Math.PI;
        const backdist = item.ang - Math.PI;
        if (Math.abs(pbackdist) < 0.5 * Math.PI && Math.abs(backdist) < 0.5 * Math.PI) {
            if (pbackdist < 0 && backdist > 0) {
                // rotate indices back
                rotateIndices(-1);
                item.contentIndex = backwardIndex;
                item.content = script.icons[item.contentIndex];
                item.img.mainPass.baseTex = item.content;
            } else if (pbackdist > 0 && backdist < 0) {
                // rotate indices forward
                rotateIndices(1);
                item.contentIndex = forwardIndex;
                item.content = script.icons[item.contentIndex];
                item.img.mainPass.baseTex = item.content;
            }
        }
    }
}

function snapToClosest() {
    var closestIndex = 0;
    var closestAng = Math.abs(minusPItoPI(-targetAng));

    // snap to closest item
    const angStep = 2 * Math.PI / items.length;
    for (var i = 1; i < items.length; i++) {
        const ang = minusPItoPI(targetAng + i * angStep);
        if (Math.abs(ang) < closestAng) {
            closestAng = Math.abs(ang);
            closestIndex = i;
        }
    }

    setCenteredItem(closestIndex);
}

function rotateIndices(amount) {
    backwardIndex = (backwardIndex + amount) % script.icons.length;
    forwardIndex = (forwardIndex + amount) % script.icons.length;
    if (backwardIndex < 0) {
        backwardIndex += script.icons.length;
    }
    if (forwardIndex < 0) {
        forwardIndex += script.icons.length;
    }
}

function setCenteredItem(index) {
    if (index >= items.length) {
        return;
    }

    targetAng = -2 * Math.PI / items.length * index;
    currentIndex = index;
}

function minusPItoPI(ang) {
    while (ang > Math.PI) {
        ang -= 2 * Math.PI;
    }
    while (ang < -Math.PI) {
        ang += 2 * Math.PI;
    }
    return ang;
}

function zeroTo2PI(ang) {
    while (ang < 0) {
        ang += 2 * Math.PI;
    }
    while (ang > 2 * Math.PI) {
        ang -= 2 * Math.PI;
    }
    return ang;
}

function setDelayedAction(t, func) {
    if (t < getDeltaTime()) {
        // Time is too short, call immediately
        func();
    } else {
        const evt = script.createEvent("DelayedCallbackEvent");
        evt.bind(func);
        evt.reset(t);
    }
}

script.createEvent("OnStartEvent").bind(function() {
    init();
});