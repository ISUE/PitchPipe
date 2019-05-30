// MIT License

// Copyright (c) 2019

// Eugene M. Taranta II <etaranta@gmail.com>
// Seng Lee Koh <ksenglee@knights.ucf.edu>
// Brian M. Williamson <brian.m.williamson@knights.ucf.edu>
// Kevin P. Pfeil <kevin.pfeil@knights.ucf.edu>
// Corey R. Pittman <cpittman@knights.ucf.edu>
// Joseph J. LaViola Jr. <jjl@cs.ucf.edu>
// University of Central Florida

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE. 

/**
 * Helper object for looking up and
 * interpolating points in 3D grid space.
 */
Grid = function(table) {
    var table = table;

    /**
     *
     */
    this.precision = function(jitter, cutoff_hz, beta) {

        // Jitter level goes up in steps of 1/3 start at 1/3
        jIdx = 3.0 * jitter - 1.0;
        jIdx = Math.min(jIdx, 15);
        jIdxLo = Math.floor(jIdx);
        jIdxHi = Math.ceil(jIdx);

        // Min cutoff goes up in steps of 0.05 starting at 0.05
        fcIdx = cutoff_hz / 0.05 - 0.05;
        fcIdxLo = Math.floor(fcIdx);
        fcIdxHi = Math.ceil(fcIdx);

        // Beta from 0 to 1.0,
        vals = this.GetBetaIndex(beta);
        bIdx = vals[0];
        bIdxLo = vals[1];
        bIdxHi = vals[2];

        //console.log(jIdx, jIdxLo, jIdxHi)
        //console.log(fcIdx, fcIdxLo, fcIdxHi)
        //console.log(bIdx, bIdxLo, bIdxHi)

        ret = 0.0;
        weights = 0.0;

        // Get precision using tri-linear
        // interpolation, see Wikipedia
        c000 = table[jIdxLo][fcIdxLo][bIdxLo];
        c100 = table[jIdxHi][fcIdxLo][bIdxLo];
        c010 = table[jIdxLo][fcIdxHi][bIdxLo];
        c110 = table[jIdxHi][fcIdxHi][bIdxLo];
        c001 = table[jIdxLo][fcIdxLo][bIdxHi];
        c101 = table[jIdxHi][fcIdxLo][bIdxHi];
        c011 = table[jIdxLo][fcIdxHi][bIdxHi];
        c111 = table[jIdxHi][fcIdxHi][bIdxHi];

        xd = 0.0;
        yd = 0.0;
        zd = 0.0;

        if(Math.abs(jIdxHi - jIdxLo) > Number.EPSILON)
        {
            xd = (jIdx - jIdxLo) / (jIdxHi - jIdxLo);
        }

        if(Math.abs(fcIdxHi - fcIdxLo) > Number.EPSILON)
        {
            yd = (fcIdx - fcIdxLo) / (fcIdxHi - fcIdxLo);
        }

        if(Math.abs(bIdxHi - bIdxLo) > Number.EPSILON)
        {
            zd = (bIdx - bIdxLo) / (bIdxHi - bIdxLo);
        }

        c00 = c000 * (1 - xd) + c100 * xd;
        c01 = c001 * (1 - xd) + c101 * xd;
        c10 = c010 * (1 - xd) + c110 * xd;
        c11 = c011 * (1 - xd) + c111 * xd;

        c0 = c00 * (1 - yd) + c10 * yd;
        c1 = c01 * (1 - yd) + c11 * yd;

        c = c0 * (1 - zd) + c1 * zd;

        return c;
    };

    /**
     *
     */
    this.GetBetaIndex = function(beta) {
        bIdx = 46;
        while (beta < 1.0 && bIdx > 0) {
            beta *= 10.00000001;
            bIdx -= 9;
        }

        if (bIdx < 0) {
            return [0, 0, 0];
        }

        bIdx = Math.max(bIdx - 1.0, 0);
        beta += bIdx;
        bIdxLo = Math.floor(beta);
        bIdxHi = Math.ceil(beta);
        return [beta, bIdxLo, bIdxHi];
    };
};

/**
 * Simple exponential moving average filter,
 * with auto-tuner support.
 */
function EuroFilter(min_cutoff_hz, beta) {
    // Filtered position.
    this.pos = null;

    // Filtered derivate.
    this.derivate = null;

    // How aggressively to filter.
    this.min_cutoff_hz = min_cutoff_hz;

    // Smoothing for derivate.
    this.derivate_cutoff_hz = 1.0;

    // How rapidly to increase cutoff with velocity.
    this.beta = beta;

    // Timestamp of filtered position (last update).
    this.timeStamp_s = 0.0;

    // Load up table for this test.
    var grid = new Grid(fs60);

    /**
     * Determine smoothing factor based on cutoff and time step.
     */
    this.alpha = function(cutoff_hz, delta_s) {
        return 1.0 - Math.exp(-2.0 * Math.PI * cutoff_hz * delta_s);
    };

    /**
     * Invoke after each input device reading.
     */
    this.filter = function(pos, timeStamp_s) {
        // set initial value
        if (this.pos === null) {
            this.pos = pos;
            this.derivate = 0.0;
            this.timeStamp_s = timeStamp_s;
            return pos;
        }

        // Calculate time delta.
        duration_s = timeStamp_s - this.timeStamp_s;
        this.timeStamp_s = timeStamp_s;

        // Calculate derivate and smooth it.
        derivate = (pos - this.pos) / duration_s;

        alpha = this.alpha(this.derivate_cutoff_hz, duration_s);

        this.derivate = alpha * derivate + (1.0 - alpha) * this.derivate;

        // Determine velocity based cutoff and smooth position
        cutoff = this.min_cutoff_hz + this.beta * Math.abs(this.derivate);

        alpha = this.alpha(cutoff, duration_s);

        this.lastAlpha = alpha;

        this.pos = alpha * pos + (1.0 - alpha) * this.pos;
        return this.pos;
    };

    /**
     * Measure the edge response: how long it takes
     * the filter to rise from zero to the given amplitude.
     */
    this.lag_s = function(
        targetPrecision,
        noiseStddev,
        amplitude,
        sampleRate_hz,
        handleRinging
    ) {
        this.pos = null;

        cnt = 0.0;
        delta_s = 1.0 / sampleRate_hz;

        timeStamp_s = 0.0;

        // Warm at zero.
        for (var ii = 0; ii < 2; ii++) {
            this.filter(0.0, timeStamp_s);

            timeStamp_s += delta_s;
        }

        // Go for target and measure
        // how long it takes.
        while (true) {

            this.filter(amplitude, timeStamp_s);

            cnt += 1.0;

            delta1 = Math.abs(this.pos - amplitude);

            if(handleRinging)
            {
                alpha = this.lastAlpha;
                delta2 = alpha * noiseStddev + (1.0 - alpha) * 0.0;
            }
            else
            {
                delta2 = 0.0;
            }

            if (Math.max(delta1, delta2) < targetPrecision) {
                return cnt / sampleRate_hz;
            }

            timeStamp_s += delta_s;
        }
    };

    /**
     * Given a specified target precision, noise level,
     * amplitude, and sample rate, determine how the
     * smoothing parameter should be set.
     */
    this.tune = function(
        maxTargetPrecision,
        maxLag_s,
        noiseVariance,
        maxAmplitude,
        sampleRate_hz,
        handleRinging=false)
    {
        targetPrecision = maxTargetPrecision;
        noiseStddev = Math.sqrt(noiseVariance);

        bestPrecision = Infinity;
        bestLag_s = Infinity;
        bestMinCutoff_hz = null;
        bestBeta = 1.1;

        for (; bestPrecision === Infinity; targetPrecision += 1.0 / 3) {
            for (var min_hz = 0.1; min_hz < 4.0; min_hz += 0.01) {
                this.min_cutoff_hz = min_hz;

                beta = 1.0;
                for (var scale = 1.0; scale <= 5; scale += 1.0) {
                    step = Math.pow(10.0, -scale);
                    step /= 4.0;

                    for (var ii = 0.0; ii < 9 * 4.0; ii++) {
                        beta -= step;
                        beta = Math.round(beta * 1e6) / 1e6;

                        precision = grid.precision(noiseStddev, min_hz, beta);

                        if (precision > targetPrecision) {
                            continue;
                        }

                        this.beta = beta;

                        lag_s = this.lag_s(
                            targetPrecision,
                            noiseStddev,
                            maxAmplitude,
                            sampleRate_hz,
                            handleRinging
                        );

                        accept = true;

                        // if we already have a lag that is less than the 
                        // max, then take new result only if precision is better
                        if(bestLag_s <= maxLag_s)
                        {
                            if(lag_s >= maxLag_s)
                            {
                                accept = false;
                            }
                            else if(precision > bestPrecision)
                            {
                                accept = false;
                            }
                        }
                        else if (lag_s > bestLag_s)
                        {
                            accept = false;
                        }

                        if(accept == false)
                            continue;

                        bestPrecision = precision;
                        bestLag_s = lag_s;
                        bestBeta = beta;
                        bestMinCutoff_hz = min_hz;
                    }
                }
            }
        }

        this.min_cutoff_hz = bestMinCutoff_hz;
        this.beta = bestBeta;

        console.log(
            "noise: ",
            noiseStddev,
            "amp:",
            maxAmplitude,
            "target: ",
            maxTargetPrecision,
            "Lag",
            maxLag_s);

        console.log("min_cutoff_hz: " + this.min_cutoff_hz);
        console.log("beta: " + this.beta);
        console.log("precision: " + bestPrecision);
        console.log("lag_s: " + bestLag_s);
        console.log("\n");
    };
}

// Description of this filter.
EuroFilter.description = "1€ Filter";

EuroFilter.instructions =

'<p>These instructions are designed to help you calibrate the jittery cursor, so you can hit the targets in the left panel as quickly and accurately as possible. In the first step, you will calibrate for smoothness and precision, but this will slow down the cursor. In the second step you will tune for speed, but this will reintroduce small of amounts jitter. Therefore, in the third step, you will make final adjustments for overall performance.</p>' +
'<p>Complete the following three calibration steps:</p>' +
'<p>Step 1) Adjust the above <b>Error</b> parameter until you are comfortable with the cursor at <it>slow</it> speeds (lower error means less jitter and higher precision), and ensure you are able to accurately hit the circular targets in the left panel. Note that speed is unimportant in this step, but will be addressed next. Do NOT adjust <b>Speed</b>. Once satisfied, proceed to step 2.</p>' +
'<p>Step 2) Adjust the above <b>Speed</b> parameter until you are happy with the cursor\'s performance at faster speeds. Specifically, test your settings by clicking on the highlighted targets as quickly and accurately as possible.  We suggest you try 0.0001, 0.001, 0.01, and then adjust further according to your preference. Do not modify the <b>Error</b> parameter. Once satisfied, proceed to step 3.</p>' +
'<p>Step 3) Again, click on the highlighted targets as quickly and accurately as possible, and adjust either parameter until you are happy with overall performance.  Note, lower <b>Error</b> values will reduce jitter but slow down the cursor. Higher <b>Speed</b> values will increase speed but also increase jitter. Once you are happy with overall performance and can accurately hit the targets, click on the DONE button above.</p>' +
'<p>If you want to restart this procedure at any time during this calibration phase, you can simply hit the reset button by each parameter. Once the test starts, however, you will not be able to make further changes.</p>'

// Parameters that can be tuned.
EuroFilter.parameters = [
    {
        name: "min_cutoff_hz",
        description: "Error",
        min: 0.1,
        max: 15.0,
        def: 15.0,
        step: 0.01,
        logstep: true
    },
    {
        name: "beta",
        description: "Speed",
        min: 0.00001,
        max: 0.1,
        def: 0.0,
        step: 0.0001,
        logstep: true
    },
    {
        name: "noise",
        description: "Noise",
        min: 0,
        max: 16,
        def: 8,
        step: 1,
        logstep: false
    }
];

//euro = new EuroFilter(1,1)
//euro.tune(1.0/3.0, 0.08, 2.91685370609251, 728, 62);
