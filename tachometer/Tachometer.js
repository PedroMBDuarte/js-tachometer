"use strict";

$.widget("tachometer", {
    // default options
    options: {
        firstRange: {
            color: '#EF4836',
            upperLimit: 100
        },
        secondRange: null,
        thirdRange: null,
        firstIndicatorLabel: 'Indicator1',
        firstIndicatorValue: 0,
        firstIndicatorColor: '#433A4D',
        secondIndicatorLabel: 'Indicator2',
        secondIndicatorValue: 0,
        secondIndicatorColor: '#9C96A4',
        startValue: 0,
        startValueOffsetInDegrees: 135,
        apertureAngleInDegrees: 270, // Maximum: 360
        numberOfTicksShowing: 6,
        tickFormat: 'triangle', // TickFormat: bar or triangle
        outerTickLenth: 10,
        innerTickLenth: 9,
        height: 210,
        width: 290,
        centerX: 145,
        centerY: 115,
        radius: 100,
        units: 'Tons',
        numberDecimalSeparator: '.',
        numberThousandsSeparator: ',',
        backgroundImageUrl: ''
    },

    //TODO: what happens when the indicator has a value greater than or lower than the maximum or minimum of the tachometer?

    currentfirstIndicatorValue: 0,
    currentsecondIndicatorValue: 0,
    job: null,
    ctx: null,
    _indicatorIncrementStep: 4,
    _indicatorIncrementStepSecond: 1,
    _firstIndicatorPoints: [],
    _secondIndicatorPoints: [],
    _countryImage: null,
    _imageLoaded: false,
    _originalDocumentWidth: null,
    _elementGuid: null,

    _create: function () {
        var self = this;

        var isValid = self._validateOptions();

        if (isValid) {
            self._originalDocumentWidth = $(document).width();

            self._elementGuid = self.guid();

            var canvas = self._createHiDPICanvas(self.options.width, self.options.height, "tachometer-" + self._elementGuid);

            self.element.html(canvas);

            self.ctx = canvas.getContext('2d');

            // update these variables so that the animation starts at the right place
            self.currentfirstIndicatorValue = self.options.startValue;
            self.currentsecondIndicatorValue = self.options.startValue;

            if (self._getLimitValue() <= 500) {
                self._indicatorIncrementStepFirst = 1;
                self._indicatorIncrementStepSecond = 0.5;
            } else if (self._getLimitValue() <= 3000) {
                self._indicatorIncrementStepFirst = 8;
                self._indicatorIncrementStepSecond = 3;
            } else {
                self._indicatorIncrementStepFirst = Math.floor(self._getLimitValue() * 4 / 1200);
                self._indicatorIncrementStepSecond = Math.floor(self._getLimitValue() / 1200);
            }

            self._countryImage = new Image();
            self._countryImage.src = self.options.backgroundImageUrl; // can also be a remote URL e.g. http://
            self._countryImage.onload = function () {
                self._imageLoaded = true;
            };

            self._drawTachometer(self);

            var tooltipCanvas = self._createHiDPICanvas(100, 25, "tachometer-gauge-tooltip-" + self._elementGuid);
            tooltipCanvas.setAttribute("class", "tachometer-gauge-tooltip");
            self.element.append(tooltipCanvas);

            self.element.click(function (e) {
                self._showToolTip(e);
            });
        }
    },

    guid: function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
              .toString(16)
              .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    },

    _showToolTip: function (e) {
        var self = this;

        var tooltipCanvas = document.getElementById("tachometer-gauge-tooltip-" + self._elementGuid);
        var tooltipCtx = tooltipCanvas.getContext("2d");

        var tachometerCanvas = document.getElementById('tachometer-' + self._elementGuid);
        var tachometerCtx = tachometerCanvas.getContext("2d");

        var mouseX = parseInt((e.offsetX === undefined ? (e.pageX - $(e.target).offset().left) : e.offsetX) * self._getPixelRatio());
        var mouseY = parseInt((e.offsetY === undefined ? (e.pageY - $(e.target).offset().top) : e.offsetY) * self._getPixelRatio());

        var hit = false;

        var tooltipMarginFromPointer = 10;
        var paddingX = 6;
        var paddingY = 17;
        var lineHeight = 25;

        var isOverFirstIndicator = self._isPointInPoly(self._firstIndicatorPoints, { x: mouseX, y: mouseY }, tachometerCtx);
        var isOverSecondIndicator = self._isPointInPoly(self._secondIndicatorPoints, { x: mouseX, y: mouseY }, tachometerCtx);

        tooltipCtx.fillStyle = 'rgb(255,255,255)';
        tooltipCtx.font = "normal 14px 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";

        if (isOverFirstIndicator && isOverSecondIndicator) {
            var textWidthFirst = tooltipCtx.measureText(self.options.firstIndicatorLabel + ': ' + self._getIndicatorValueForTooltip(self.options.firstIndicatorValue)).width;
            var textWidthSecond = tooltipCtx.measureText(self.options.secondIndicatorLabel + ': ' + self._getIndicatorValueForTooltip(self.options.secondIndicatorValue)).width;
            var tooltipWidth = Math.max(textWidthFirst, textWidthSecond) + (paddingX * 2);

            self._calculateTooltipPositionAndSize(tooltipCanvas, mouseX, mouseY, tooltipWidth, lineHeight * 2, tachometerCanvas, self.element.offset().left, tooltipMarginFromPointer);

            self._drawTooltipMultiLine(tooltipCtx,
                tooltipWidth,
                tooltipCanvas.height,
                self.options.firstIndicatorLabel,
                self._getIndicatorValueForTooltip(self.options.firstIndicatorValue),
                self.options.secondIndicatorLabel,
                self._getIndicatorValueForTooltip(self.options.secondIndicatorValue),
                paddingX,
                paddingY,
                lineHeight);

            hit = true;
        } else if (isOverFirstIndicator) {
            var textWidth = tooltipCtx.measureText(self.options.firstIndicatorLabel + ': ' + self.options.firstIndicatorValue).width;
            var tooltipWidth = textWidth + (paddingX * 2);

            self._calculateTooltipPositionAndSize(tooltipCanvas, mouseX, mouseY, tooltipWidth, lineHeight, tachometerCanvas, self.element.offset().left, tooltipMarginFromPointer);

            self._drawTooltipSingle(tooltipCtx, tooltipWidth, tooltipCanvas.height, self.options.firstIndicatorLabel, self._getIndicatorValueForTooltip(self.options.firstIndicatorValue), paddingX, paddingY, 'rgb(67,58,77)');

            hit = true;
        } else if (isOverSecondIndicator) {
            var textWidth = tooltipCtx.measureText(self.options.secondIndicatorLabel + ': ' + self.options.secondIndicatorValue).width;
            var tooltipWidth = textWidth + (paddingX * 2);

            self._calculateTooltipPositionAndSize(tooltipCanvas, mouseX, mouseY, tooltipWidth, lineHeight, tachometerCanvas, self.element.offset().left, tooltipMarginFromPointer);

            self._drawTooltipSingle(tooltipCtx, tooltipWidth, tooltipCanvas.height, self.options.secondIndicatorLabel, self._getIndicatorValueForTooltip(self.options.secondIndicatorValue), paddingX, paddingY, 'rgb(156,150,164)');

            hit = true;
        }

        if (!hit) {
            tooltipCanvas.style.display = "none";
        } else {
            tooltipCanvas.style.display = "block";
        }
    },

    _validateOptions: function () {
        var self = this;

        var isValid = true;

        // validations
        if (self.options.gaugeAperture > 360) {
            isValid = false;
            console.log("Value for gaugeAperture can't be greater than 360.");
        }

        if (typeof (self.options.firstRange) != 'undefined' && self.options.firstRange != null
            && typeof (self.options.secondRange) != 'undefined' && self.options.secondRange != null
            && typeof (self.options.thirdRange) != 'undefined' && self.options.thirdRange != null) {
            if (!(self.options.firstRange.upperLimit > self.options.secondRange.upperLimit > self.options.thirdRange.upperLimit) && !(self.options.firstRange.upperLimit < self.options.secondRange.upperLimit < self.options.thirdRange.upperLimit)) {
                isValid = false;
                console.log("All sections must follow the same order: crescent or decrescent.");
            }
        }

        // make sure that the indicators do not point to a value greater than the maximum or lower than the minimum
        if (self.options.firstIndicatorValue < self.options.startValue) {
            self.options.firstIndicatorValue = self.options.startValue;
        }

        if (self.options.secondIndicatorValue < self.options.startValue) {
            self.options.secondIndicatorValue = self.options.startValue;
        }

        if (self.options.firstIndicatorValue == null) {
            self.currentfirstIndicatorValue = 0;
        }

        if (self.options.secondIndicatorValue == null) {
            self.currentsecondIndicatorValue = 0;
        }

        return isValid;
    },

    _drawTachometer: function (widgetObj) {
        // Canvas good?
        if (widgetObj.ctx) {
            widgetObj._clearCanvas();

            widgetObj._drawInnerCircle();

            if (widgetObj.options.firstIndicatorValue > 0) {
                widgetObj._drawBackground();
            }

            // Draw tachometer colour arc
            widgetObj._drawTachometerColourArc();

            // Draw tick marks
            if (widgetObj.options.tickFormat == 'bar') {
                widgetObj._drawTicks();
            } else {
                widgetObj._drawTriangleTicks();
            }

            widgetObj._drawTextMarkers();

            widgetObj._secondIndicatorPoints = widgetObj._drawValueIndicator(widgetObj.currentsecondIndicatorValue, widgetObj.options.secondIndicatorColor);

            widgetObj._firstIndicatorPoints = widgetObj._drawValueIndicator(widgetObj.currentfirstIndicatorValue, widgetObj.options.firstIndicatorColor);

            // Uncomment to show units
            //widgetObj._drawUnits();

            if ((widgetObj.currentfirstIndicatorValue >= widgetObj.options.firstIndicatorValue || widgetObj.currentfirstIndicatorValue == widgetObj._getLimitValue())
                && (widgetObj.currentsecondIndicatorValue >= widgetObj.options.secondIndicatorValue || widgetObj.currentsecondIndicatorValue == widgetObj._getLimitValue())) {
                clearTimeout(widgetObj.job);

                return;
            }

            // incrementing first value
            var firstIndicatorLimitValue = Math.min(widgetObj.options.firstIndicatorValue, widgetObj._getLimitValue());

            if (widgetObj.currentfirstIndicatorValue < widgetObj.options.firstIndicatorValue && widgetObj.currentfirstIndicatorValue < widgetObj._getLimitValue()) {
                if (widgetObj.currentfirstIndicatorValue + (firstIndicatorLimitValue * 0.01) > firstIndicatorLimitValue) {
                    widgetObj.currentfirstIndicatorValue = widgetObj.currentfirstIndicatorValue + 1;
                } else if (widgetObj.currentfirstIndicatorValue + (firstIndicatorLimitValue * 0.1) > firstIndicatorLimitValue) {
                    widgetObj.currentfirstIndicatorValue = widgetObj.currentfirstIndicatorValue + widgetObj._indicatorIncrementStepSecond;
                } else {
                    widgetObj.currentfirstIndicatorValue = widgetObj.currentfirstIndicatorValue + widgetObj._indicatorIncrementStepFirst;
                }
            }

            // incrementing second value
            var secondIndicatorLimitValue = Math.min(widgetObj.options.secondIndicatorValue, widgetObj._getLimitValue());

            if (widgetObj.currentsecondIndicatorValue < widgetObj.options.secondIndicatorValue && widgetObj.currentsecondIndicatorValue < widgetObj._getLimitValue()) {
                if (widgetObj.currentsecondIndicatorValue + (widgetObj.options.secondIndicatorValue * 0.01) > secondIndicatorLimitValue) {
                    widgetObj.currentsecondIndicatorValue = widgetObj.currentsecondIndicatorValue + 1;
                } else if (widgetObj.currentsecondIndicatorValue + (secondIndicatorLimitValue * 0.1) > secondIndicatorLimitValue) {
                    widgetObj.currentsecondIndicatorValue = widgetObj.currentsecondIndicatorValue + widgetObj._indicatorIncrementStepSecond;
                } else {
                    widgetObj.currentsecondIndicatorValue = widgetObj.currentsecondIndicatorValue + widgetObj._indicatorIncrementStepFirst;
                }
            }

            widgetObj.job = setTimeout(function () { widgetObj._drawTachometer(widgetObj); }, 5);
        } else {
            console.log("Canvas not supported by your browser!");
        }
    },

    _isPointInPoly: function (poly, pt, ctx) {
        //dummy drawing
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (var i = 1; i < poly.length; i++) {
            ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();

        return (ctx.isPointInPath(pt.x, pt.y));
    },

    _degToRad: function (angle) {
        return ((angle * Math.PI) / 180);
    },

    _radToDeg: function (angle) {
        return ((angle * 180) / Math.PI);
    },

    _drawLine: function (line) {
        var self = this;
        // Draw a line using the line object passed in
        self.ctx.beginPath();

        // Set attributes of open
        self.ctx.globalAlpha = line.alpha;
        self.ctx.lineWidth = line.lineWidth;
        self.ctx.fillStyle = line.fillStyle;
        self.ctx.strokeStyle = line.fillStyle;
        self.ctx.moveTo(line.from.X, line.from.Y);

        // Plot the line
        self.ctx.lineTo(line.to.X, line.to.Y);

        self.ctx.stroke();
    },

    _createLine: function (fromX, fromY, toX, toY, fillStyle, lineWidth, alpha) {
        // Create a line object using Javascript object notation
        return {
            from: { X: fromX, Y: fromY },
            to: { X: toX, Y: toY },
            fillStyle: fillStyle,
            lineWidth: lineWidth,
            alpha: alpha
        };
    },

    _applyDefaultContextSettings: function () {
        var self = this;
        /* Helper function to revert to gauges default settings */
        self.ctx.lineWidth = 2;
        self.ctx.globalAlpha = 1;
        self.ctx.strokeStyle = "rgb(255, 255, 255)";
        self.ctx.fillStyle = 'rgb(255,255,255)';
    },

    _drawBackground: function () {
        var self = this;

        if (self._imageLoaded) {
            // 0.48 is the ratio do keep the right size
            var newWidth = self.options.width - (self.options.width * 0.48);
            var newHeight = (newWidth * self._countryImage.naturalHeight) / self._countryImage.naturalWidth;
            self.ctx.drawImage(self._countryImage, self.options.centerX - (newWidth / 2), self.options.centerY - (newHeight / 2), newWidth, newHeight);
        }
    },

    _drawTicks: function () {
        var self = this;

        var offset = self.options.startValueOffsetInDegrees;

        self._applyDefaultContextSettings();

        var iTick = 0,
            iTickRad = 0,
            step = self.options.apertureAngleInDegrees / self.options.numberOfTicksShowing,
            counter = 1;;

        for (iTick = offset - 180; iTick < self.options.apertureAngleInDegrees + offset - 180; iTick = iTick + step) {
            if (iTick == offset - 180)
                continue;

            iTickRad = self._degToRad(iTick);

            self._drawOuterTick(iTickRad);

            self._drawInnerTick(iTickRad, counter, step);

            counter++;
        }
    },

    _drawOuterTick: function (tickAngleRad) {
        var self = this;

        var originalComposite = self.ctx.globalCompositeOperation;
        self.ctx.globalCompositeOperation = 'destination-out';

        self._drawTick(tickAngleRad, self.options.outerTickLenth, "rgba(0,0,0,1)", 5, 1);

        self.ctx.globalCompositeOperation = originalComposite;
    },

    _drawInnerTick: function (tickAngleRad, counter, step) {
        var self = this;

        var translatedDegree = counter * step;

        var color = "#000000";

        var firstRangeLength = typeof (self.options.firstRange) != 'undefined' && self.options.firstRange != null ? self._convertValueToAngle(self.options.firstRange.upperLimit) : 0;
        var secondZoneLength = typeof (self.options.secondRange) != 'undefined' && self.options.secondRange != null ? self._convertValueToAngle(self.options.secondRange.upperLimit) : 0;
        var thirdZoneLength = typeof (self.options.thirdRange) != 'undefined' && self.options.thirdRange != null ? self._convertValueToAngle(self.options.thirdRange.upperLimit) : 0;

        if (typeof (self.options.firstRange) != 'undefined' && self.options.firstRange != null && translatedDegree % 360 >= 0 && translatedDegree % 360 < firstRangeLength % 360) {
            color = self.options.firstRange.color;
        } else if (typeof (self.options.secondRange) != 'undefined' && self.options.secondRange != null && translatedDegree % 360 >= firstRangeLength % 360 && translatedDegree % 360 < firstRangeLength + secondZoneLength % 360) {
            color = self.options.secondRange.color;
        } else if (typeof (self.options.thirdRange) != 'undefined' && self.options.thirdRange != null && translatedDegree % 360 >= firstRangeLength + secondZoneLength % 360 && translatedDegree % 360 <= firstRangeLength + secondZoneLength + thirdZoneLength % 360) {
            color = self.options.thirdRange.color;
        }

        self._drawTick(tickAngleRad, self.options.innerTickLenth, color, 2, 0.7);
    },

    _drawTick: function (tickAngleRad, radiusLengthModifier, tickColor, tickWidth, tickOpacity) {
        var self = this;

        var innerTickY,
			innerTickX,
			onArchX,
			onArchY,
			fromX,
			fromY,
			toX,
			toY,
			line;

        onArchX = self.options.radius - (Math.cos(tickAngleRad) * self.options.radius);
        onArchY = self.options.radius - (Math.sin(tickAngleRad) * self.options.radius);
        innerTickX = self.options.radius - (Math.cos(tickAngleRad) * (self.options.radius + radiusLengthModifier));
        innerTickY = self.options.radius - (Math.sin(tickAngleRad) * (self.options.radius + radiusLengthModifier));

        fromX = (self.options.centerX - self.options.radius) + onArchX;
        fromY = (self.options.centerY - self.options.radius) + onArchY;
        toX = (self.options.centerX - self.options.radius) + onArchX + (onArchX - innerTickX);
        toY = (self.options.centerY - self.options.radius) + onArchY + (onArchY - innerTickY);

        // Create a line expressed in JSON
        line = self._createLine(fromX, fromY, toX, toY, tickColor, tickWidth, tickOpacity);

        // Draw the line
        self._drawLine(line);
    },

    _drawTriangleTicks: function () {
        var self = this;

        var offset = self.options.startValueOffsetInDegrees;

        var originalComposite = self.ctx.globalCompositeOperation;

        self._applyDefaultContextSettings();

        var iTick = 0,
            iTickRad = 0,
            step = self.options.apertureAngleInDegrees / self.options.numberOfTicksShowing,
            angleAperture = 3;

        for (iTick = offset - 180; iTick <= self.options.apertureAngleInDegrees + offset - 180; iTick = iTick + step) {
            iTickRad = self._degToRad(iTick);

            var onArchX = self.options.radius - (Math.cos(iTickRad) * self.options.radius);
            var onArchY = self.options.radius - (Math.sin(iTickRad) * self.options.radius);

            var innerTickX = self.options.radius - (Math.cos(iTickRad) * (self.options.radius + 8));
            var innerTickY = self.options.radius - (Math.sin(iTickRad) * (self.options.radius + 8));

            var toX = (self.options.centerX - self.options.radius) + onArchX + (onArchX - innerTickX);
            var toY = (self.options.centerY - self.options.radius) + onArchY + (onArchY - innerTickY);

            self.ctx.globalCompositeOperation = 'destination-out';
            self.ctx.beginPath();
            self.ctx.fillStyle = "rgba(0,0,0,1)";
            self.ctx.moveTo(toX, toY);
            // 180 is the compensation for working with two different referentials
            self.ctx.arc(self.options.centerX, self.options.centerY, self.options.radius + 1, self._degToRad(iTick + 180 - angleAperture), self._degToRad(iTick + 180 + angleAperture));
            self.ctx.moveTo(toX, toY);
            self.ctx.closePath();
            self.ctx.fill();
        }

        self.ctx.globalCompositeOperation = originalComposite;
    },

    _drawTextMarkers: function () {
        var self = this;

        var innerTickX = 0,
			innerTickY = 0,
			iTick = 0,
			iTickToPrintAng = 0,
			tickToPrintVal = 0,
			numberLengthInPx,
			textMarkerOffsetX,
			textMarkerOffsetY,
			textPositionX,
			textPositionY;

        self._applyDefaultContextSettings();

        var offset = self.options.startValueOffsetInDegrees;

        var step = self.options.apertureAngleInDegrees / self.options.numberOfTicksShowing;

        // approximately font letter width
        var letterWidth = 7;
        var letterHeigth = 10;
        // Font styling
        self.ctx.font = 'normal 10px sans-serif';
        self.ctx.fillStyle = '#000000';
        self.ctx.textBaseline = 'top';

        self.ctx.beginPath();

        for (iTick = offset - 180; iTick <= self.options.apertureAngleInDegrees + offset - 180; iTick = iTick + step) {
            innerTickX = self.options.radius - (Math.cos(self._degToRad(iTick)) * self.options.radius);
            innerTickY = self.options.radius - (Math.sin(self._degToRad(iTick)) * self.options.radius);

            tickToPrintVal = self._convertAngleToValue(iTickToPrintAng);
            numberLengthInPx = tickToPrintVal.toString().length * letterWidth;
            textMarkerOffsetX = 0;
            textMarkerOffsetY = 0;

            textPositionX = self.options.centerX - self.options.radius + innerTickX;
            textPositionY = self.options.centerY - self.options.radius + innerTickY;

            if (textPositionX < self.options.centerX - 15) {
                textMarkerOffsetX = -numberLengthInPx;
            } else if (textPositionX >= self.options.centerX - 15 && textPositionX <= self.options.centerX + 15) {
                textMarkerOffsetX = -numberLengthInPx / 2.5;
            } else {
                textMarkerOffsetX = 3;
            }

            if (textPositionY < self.options.centerY - 15) {
                textMarkerOffsetY = letterHeigth / 2;
            } else if (textPositionY > self.options.centerY + 15) {
                textMarkerOffsetY = -letterHeigth / 2;
            }

            self.ctx.fillText(tickToPrintVal, (self.options.centerX - self.options.radius) + innerTickX + textMarkerOffsetX, (self.options.centerY - self.options.radius - 6 - textMarkerOffsetY) + innerTickY);

            iTickToPrintAng += step;
        }

        self.ctx.stroke();
    },

    _drawTachometerPart: function (alphaValue, strokeStyle, startPos, endPos, lineWidth) {
        var self = this;

        self.ctx.beginPath();

        self.ctx.globalAlpha = alphaValue;
        self.ctx.lineWidth = lineWidth;
        self.ctx.strokeStyle = strokeStyle;

        var offset = self.options.startValueOffsetInDegrees;

        self.ctx.arc(self.options.centerX, self.options.centerY, self.options.radius - lineWidth / 2, self._degToRad(startPos + offset), self._degToRad(endPos + offset), false);

        self.ctx.stroke();
    },

    _drawTachometerColourArc: function () {
        var self = this;

        var hasFirstRange = typeof (self.options.firstRange) != 'undefined' && self.options.firstRange != null;
        var hasSecondRange = typeof (self.options.secondRange) != 'undefined' && self.options.secondRange != null;
        var hasThirdRange = typeof (self.options.thirdRange) != 'undefined' && self.options.thirdRange != null;

        var firstRangeLength = hasFirstRange ? self._convertValueToAngleLength(self.options.firstRange.upperLimit - self.options.startValue) : 0;
        var secondZoneLength = hasSecondRange ? self._convertValueToAngleLength(self.options.secondRange.upperLimit - (hasFirstRange ? self.options.firstRange.upperLimit : self.options.startValue)) : 0;
        var thirdZoneLength = hasThirdRange ? self._convertValueToAngleLength(self.options.thirdRange.upperLimit - (hasSecondRange ? self.options.secondRange.upperLimit : (hasFirstRange ? self.options.firstRange.upperLimit : self.options.startValue))) : 0;

        var lineWidth = 30;

        if (hasFirstRange) {
            self._drawTachometerPart(1.0, self.options.firstRange.color, 0, firstRangeLength, lineWidth);
        }

        if (hasSecondRange) {
            self._drawTachometerPart(1.0, self.options.secondRange.color, firstRangeLength, firstRangeLength + secondZoneLength, lineWidth);
        }

        if (hasThirdRange) {
            self._drawTachometerPart(1.0, self.options.thirdRange.color, firstRangeLength + secondZoneLength, firstRangeLength + secondZoneLength + thirdZoneLength, lineWidth);
        }
    },

    _drawInnerCircle: function () {
        var self = this;

        // TODO: make this an option, for each section
        var maxWidth = 40;
        var innerCircleRadius = self.options.radius - maxWidth + (maxWidth * 0.1);

        self.ctx.beginPath();
        self.ctx.globalAlpha = 0.5;
        self.ctx.lineWidth = 1;
        self.ctx.strokeStyle = '#433A4D';
        self.ctx.arc(self.options.centerX, self.options.centerY, innerCircleRadius, 0, 2 * Math.PI);
        self.ctx.stroke();
    },

    _convertValueToAngleLength: function (value) {
        var self = this;

        var valueInDegrees = (value / self._getLimitValue()) * self.options.apertureAngleInDegrees;

        return valueInDegrees;
    },

    _convertValueToAngle: function (value) {
        var self = this;

        var valueInDegrees = (value / self._getLimitValue()) * self.options.apertureAngleInDegrees;

        var valueWithOffset = valueInDegrees + self.options.startValueOffsetInDegrees;

        return valueWithOffset;
    },

    _convertValueToAngleFromCanvasReferential: function (value) {
        var self = this;

        var valueInDegrees = ((value + Math.abs(self.options.startValue)) / self._getLimitValue()) * self.options.apertureAngleInDegrees;

        var valueWithOffset = valueInDegrees + self.options.startValueOffsetInDegrees + 180;

        return valueWithOffset;
    },

    _convertAngleToValue: function (angle) {
        var self = this;

        var intNumber = Math.floor(self._getLimitValue() * (angle / (self.options.apertureAngleInDegrees))) + self.options.startValue;

        return intNumber.formatNumber(0, self.options.numberDecimalSeparator, self.options.numberThousandsSeparator);
    },

    _drawValueIndicator: function (value, color) {
        var self = this;

        var indicatorRadius = 10;

        var valueAsAngle = self._convertValueToAngleFromCanvasReferential(value);

        var valueAsAngleRad = self._degToRad(valueAsAngle);
        var centerRightRad = self._degToRad(valueAsAngle + 90);
        var centerLeftRad = self._degToRad(valueAsAngle - 90);

        var onArchX = (self.options.centerX) - (Math.cos(valueAsAngleRad) * self.options.radius);
        var onArchY = (self.options.centerY) - (Math.sin(valueAsAngleRad) * self.options.radius);

        var centerRightX = self.options.radius - (Math.cos(centerRightRad) * indicatorRadius) + (self.options.centerX - self.options.radius);
        var centerRightY = self.options.radius - (Math.sin(centerRightRad) * indicatorRadius) + (self.options.centerY - self.options.radius);

        var lowerEdgeX = (self.options.centerX) + (Math.cos(valueAsAngleRad) * 10);
        var lowerEdgeY = (self.options.centerY) + (Math.sin(valueAsAngleRad) * 10);

        var centerLeftX = self.options.radius - (Math.cos(centerLeftRad) * indicatorRadius) + (self.options.centerX - self.options.radius);
        var centerLeftY = self.options.radius - (Math.sin(centerLeftRad) * indicatorRadius) + (self.options.centerY - self.options.radius);

        self.ctx.beginPath();

        self.ctx.globalAlpha = 1;
        self.ctx.lineWidth = 0;
        self.ctx.fillStyle = color;

        self.ctx.moveTo(onArchX, onArchY);
        self.ctx.lineTo(centerRightX, centerRightY);
        self.ctx.lineTo(lowerEdgeX, lowerEdgeY);
        self.ctx.lineTo(centerLeftX, centerLeftY);
        self.ctx.closePath();

        self.ctx.fill();

        return [{ x: onArchX, y: onArchY }, { x: centerRightX, y: centerRightY }, { x: lowerEdgeX, y: lowerEdgeY }, { x: centerLeftX, y: centerLeftY }];
    },

    _drawUnits: function () {
        var self = this;

        var letterWidth = 7;
        var letterHeigth = 10;

        var unitsStringLen = self.options.units.toString().length;
        var numberLengthInPx = unitsStringLen * letterWidth;

        // Font styling
        self.ctx.font = 'normal 12px sans-serif';
        self.ctx.fillStyle = self.options.secondIndicatorColor;
        self.ctx.textBaseline = 'top';

        self.ctx.fillText(self.options.units, self.options.centerX - numberLengthInPx / 2, self.options.centerY + self.options.radius / 3);
    },

    _getLimitValue: function () {
        var self = this;

        var firstRange = typeof (self.options.firstRange) != 'undefined' && self.options.firstRange != null ? self.options.firstRange.upperLimit : 0;
        var secondZone = typeof (self.options.secondRange) != 'undefined' && self.options.secondRange != null ? self.options.secondRange.upperLimit : 0;
        var thirdZone = typeof (self.options.thirdRange) != 'undefined' && self.options.thirdRange != null ? self.options.thirdRange.upperLimit : 0;

        var maximumValue = Math.max(firstRange, secondZone, thirdZone, self.options.startValue);
        var minimumValue = Math.min(firstRange, secondZone, thirdZone, self.options.startValue);

        return maximumValue - minimumValue;
    },

    _clearCanvas: function () {
        var self = this;

        self.ctx.clearRect(0, 0, 800, 600);
        self._applyDefaultContextSettings();
    },

    _calculateTooltipPositionAndSize: function (tooltipCanvas, mouseX, mouseY, width, height, tachometerCanvas, parentElementOffsetX, marginFromPointer) {
        var left = (mouseX + $(tachometerCanvas).offset().left - parentElementOffsetX + marginFromPointer) / this._getPixelRatio();
        var top = mouseY / this._getPixelRatio();

        if (left + width + $(tooltipCanvas).parent().offset().left > this._originalDocumentWidth) {
            left = left - (left / 2);
            top = top - (height + (height / 3));
        }

        tooltipCanvas.style.left = left + "px";
        tooltipCanvas.style.top = top + "px";
        tooltipCanvas.width = width;
        tooltipCanvas.height = height;
        tooltipCanvas.style.width = width + "px";
        tooltipCanvas.style.height = height + "px";
    },

    _drawTooltipSingle: function (tooltipCtx, width, height, label, value, paddingX, paddingY, fillStyle) {
        var self = this;
        tooltipCtx.clearRect(0, 0, width, height);
        self._drawRoundRectangle(tooltipCtx, 0, 0, width, height, 6, true, "rgba(255, 255, 255, 0.8)", true);
        //tooltipCtx.fillStyle = 'rgb(255,255,255)';
        tooltipCtx.fillStyle = fillStyle;
        tooltipCtx.font = "normal 14px 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        tooltipCtx.fillText(label + ': ' + value, paddingX, paddingY);
    },

    _drawTooltipMultiLine: function (tooltipCtx, width, height, firstLabel, firstValue, secondLabel, secondValue, paddingX, paddingY, lineHeight) {
        var self = this;

        tooltipCtx.clearRect(0, 0, width, height);
        tooltipCtx.strokeStyle = "rgb(0, 0, 0)";
        self._drawRoundRectangle(tooltipCtx, 0, 0, width, height, 6, true, "rgba(255, 255, 255, 0.8)", true);
        //tooltipCtx.fillStyle = 'rgb(255,255,255)';
        tooltipCtx.fillStyle = 'rgb(67,58,77)';
        tooltipCtx.font = "normal 14px 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        tooltipCtx.fillText(firstLabel + ': ' + firstValue, paddingX, paddingY);
        tooltipCtx.fillStyle = 'rgb(156,150,164)';
        tooltipCtx.fillText(secondLabel + ': ' + secondValue, paddingX, paddingY + lineHeight);
    },

    _getIndicatorValueForTooltip: function (indicatorValue) {
        var self = this;

        if (typeof indicatorValue == 'undefined') {
            return '-';
        }

        if (indicatorValue == null) {
            return '-';
        }

        return indicatorValue.formatNumber(0, self.options.numberDecimalSeparator, self.options.numberThousandsSeparator);;
    },

    _getPixelRatio: function () {
        var ctx = document.createElement("canvas").getContext("2d"),
            dpr = window.devicePixelRatio || 1,
            bsr = ctx.webkitBackingStorePixelRatio ||
                  ctx.mozBackingStorePixelRatio ||
                  ctx.msBackingStorePixelRatio ||
                  ctx.oBackingStorePixelRatio ||
                  ctx.backingStorePixelRatio || 1;

        return dpr / bsr;
    },

    _createHiDPICanvas: function (w, h, id, ratio) {
        if (!ratio) { ratio = this._getPixelRatio(); }
        var can = document.createElement("canvas");
        can.setAttribute("id", id);
        can.width = w * ratio;
        can.height = h * ratio;
        can.style.width = w + "px";
        can.style.height = h + "px";
        can.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
        return can;
    },

    /**
     * Draws a rounded rectangle using the current state of the canvas. 
     * If you omit the last three params, it will draw a rectangle 
     * outline with a 5 pixel border radius 
     * @param {CanvasRenderingContext2D} ctx
     * @param {Number} x The top left x coordinate
     * @param {Number} y The top left y coordinate 
     * @param {Number} width The width of the rectangle 
     * @param {Number} height The height of the rectangle
     * @param {Number} radius The corner radius. Defaults to 5;
     * @param {Boolean} fill Whether to fill the rectangle. Defaults to false.
     * @param {Boolean} stroke Whether to stroke the rectangle. Defaults to true.
     */
    _drawRoundRectangle: function (ctx, x, y, width, height, radius, fill, fillColor, stroke) {
        if (typeof stroke == "undefined") {
            stroke = true;
        }
        if (typeof radius === "undefined") {
            radius = 5;
        }
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        if (stroke) {
            ctx.stroke();
        }
    }
});