

/**
 * Example calibration system.
 */
function Calibrator(
    leastPrecision,
    worstLag_s,
    lowPassFilter)
{
    /**
     * Steps in calibration procedure.
     */
    const calibrationStates = 
    {
        WAIT_TO_START:              'wait to start',
        START:                      'start',
        ESTIMATE_SAMPLE_RATE:       'sample rate (fps)', 
        ESTIMATE_NOISE_PREPARE:     'noise (prepare)',
        ESTIMATE_NOISE:             'noise',
        ESTIMATE_AMPLITUDE_PREPARE: 'amplitude (prepare)',
        ESTIMATE_AMPLITUDE:         'amplitude',
        ESTIMATE_PARAMETERS:        'parameters',
        ESTIMATE_TUNED:             'tuned',
        COMPLETE:                   'complete',
    };

    this.states = calibrationStates;

    /**
     * This object is used to estimate the maximum 
     * amplitude (speed) the user will move AND at 
     * the same time, we estimate the sampling rate.
     */
    function EstimateSampleRate()
    {
        var frameRateEstimator = new FrameRateEstimator();

        /**
         * Feed each sampling into this update function.
         */
        this.update = function()
        {
            frameRateEstimator.update();
        }

        /**
         * Get most recent sampling rate estimate.
         */
        this.sample_hz = function()
        {
            return Math.round(frameRateEstimator.fps());
        }
    };

    /**
     * This object is used to estimate the maximum 
     * amplitude (speed) the user will move AND at 
     * the same time, we estimate the sampling rate.
     */
    function EstimateAmplitude(noiseStddev)
    {
        var distanceEstimatorX = new MaximumDistanceEstimator();
        var distanceEstimatorY = new MaximumDistanceEstimator();
        var noiseStddev = noiseStddev;

        /**
         * Feed each sampling into this update function.
         */
        this.update = function(
            posX,
            posY)
        {
            distanceEstimatorX.update(posX, noiseStddev);
            distanceEstimatorY.update(posY, noiseStddev);
        }

        /**
         * Get most recent maximum amplitude estimate.
         */
        this.amplitude = function()
        {
            return Math.max(
                distanceEstimatorX.velocity(),
                distanceEstimatorY.velocity());
        }
    };

    /**
     * Estimate noise in signal. The user ought be asked
     * to hold still during this time. Slow, idle motions
     * are okay, but rapid movements and jerks may inflate
     * the noise estimate.
     */
    function EstimateNoise(
            sample_hz,
            threshold = 0.01)
    {
        var noiseEstimatorsX = [] 
        var noiseEstimatorsY = [] 
        var stats = new RunningStatistics();
        var threshold = threshold;

        // The Nyquist frequency is half the sampling rate.
        // We can monitor those frequencies that fall 
        // between 10Hz and the Nyquist, which still allows 
        // for some slow, low frequency, idling motion.
        sample_hz = Math.round(sample_hz)
        sample_hz = sample_hz + (sample_hz % 1);

        frequency_cnt = sample_hz / 2.0 - 10.0;

        for (var ii = 0.0;
             ii < frequency_cnt;
             ii += 1)
        {
            noiseEstimatorsX.push(new NoiseEstimator(ii, sample_hz));
            noiseEstimatorsY.push(new NoiseEstimator(ii, sample_hz));
        }

        /**
         * Update estimate with new samples. Note, we assume 
         * noise is homogeneous across X and Y.
         *
         * Returns true once the 95% CI width is 
         * within a given threshold of the mean.
         */
        this.update = function(
            posX,
            posY)
        {
            var ii = 0;

            for(ii = 0;
                ii < noiseEstimatorsX.length;
                ii++)
            {
                noiseEstimatorsX[ii].update(posX);
                noiseEstimatorsY[ii].update(posY);

                varX = noiseEstimatorsX[ii].variance();
                varY = noiseEstimatorsY[ii].variance();

                if(varX == 0)
                {
                    continue;
                }

                stats.update(varX);
                stats.update(varY);
            }

            ratio = (2.0 * stats.ci95) / stats.mean;
            return (ratio < threshold); 
        }

        /**
         * Return white noise variance estimate,
         * which is the mean of our PSD estimates.
         */
        this.variance = function()
        {
            return stats.mean;
        }

        /**
         * For debug, display purposes. 
         */
        this.countDown = function()
        {
            ratio = (2.0 * stats.ci95) / stats.mean;
            return ratio - threshold;
        }
    }

    /**
     *
     */
    function RunCalibrationProcedure()
    {
        this.currentState = calibrationStates.WAIT_TO_START;
        var sampleRateEstimator = null;
        var noiseEstimator = null;
        var amplitudeEstimator = null;
        var startTime_ms = null;
        var lastUpdateTime_ms = 0.0;
        var noiseStddev = null;
        this.targetHitAttempts = 0.0;
        
        this.amplitude = 0.0;
        this.sample_hz = 0.0;
        
        var that  = this;
        
        this.estNoiseVariance = function()
        {
           return noiseEstimator.variance();
        }
        //
        
        this.update = function(x, y)
        {
            delta_ms = Date.now() - startTime_ms;

            // Give first instruction, then kick off.
            if(this.currentState == calibrationStates.START)
            {
                sampleRateEstimator = new EstimateSampleRate();
                this.currentState = calibrationStates.ESTIMATE_SAMPLE_RATE;
                startTime_ms = Date.now();
            }

            // First estimate the sample rate
            else if (this.currentState == calibrationStates.ESTIMATE_SAMPLE_RATE)
            {
                sampleRateEstimator.update();

                if(delta_ms > 2000.0)
                {
                    this.currentState = calibrationStates.ESTIMATE_NOISE_PREPARE;
                    sample_hz = sampleRateEstimator.sample_hz();
                    console.log('Sample rate: ' + sample_hz);
                    noiseEstimator = new EstimateNoise(sample_hz);
                    startTime_ms = Date.now();
                    
                    
                    that.sample_hz = sample_hz;
                    
                }
            }

            // Wait until system is ready.
            else if(this.currentState == calibrationStates.ESTIMATE_NOISE_PREPARE)
            {
                startTime_ms = Date.now();
            }    

            // Estimate noise in signal, after which we can tune 
            // the filter.
            else if (this.currentState == calibrationStates.ESTIMATE_NOISE)
            {
                // Give time for user to settle
                if(delta_ms < 1000.0)
                {
                    return this.currentState;
                }
                
                complete = noiseEstimator.update(x, y);

                if(Date.now() - lastUpdateTime_ms > 250)
                {
                    lastUpdateTime_ms = Date.now();
                }

                if(complete == true)
                {
                    noiseStddev = Math.sqrt(noiseEstimator.variance());
                    this.currentState = calibrationStates.ESTIMATE_AMPLITUDE_PREPARE;
                    amplitudeEstimator = new EstimateAmplitude(noiseStddev); 
                    this.targetHitAttempts = 0.0;   
                    startTime_ms = Date.now();
                }
            }

            // Wait for caller to advance state
            else if (this.currentState == calibrationStates.ESTIMATE_AMPLITUDE_PREPARE)
            {

            }

            // Determine maximum movement size over about three seconds,
            // then go to noise estimation state.
            else if (this.currentState == calibrationStates.ESTIMATE_AMPLITUDE)
            {
                amplitudeEstimator.update(
                    x,
                    y);
            }

            // Finally, tune the filter!
            else if (this.currentState == calibrationStates.ESTIMATE_PARAMETERS)
            {
                lowPassFilter.tune(
                    leastPrecision / 3.0,
                    worstLag_s,
                    noiseStddev * noiseStddev,
                    amplitudeEstimator.amplitude(),
                    sampleRateEstimator.sample_hz());

                this.currentState = calibrationStates.TUNED;
            
                that.amplitude = amplitudeEstimator.amplitude();
            }

            return this.currentState;
        }
    }

    this.procedure = new RunCalibrationProcedure()
}

// The smallest target in our Fitt's law test.
var minimumTargetSize = 14.0;

// Results show approximately that if spatial jitter
// is less than a quarter of the target size, the impact
// on misses is negligible.
var leastPrecision = Math.floor(minimumTargetSize * 0.25)

// Similarly, lag doesn't become much of a problem
// until it reaches above 80ms. 
var maxLag_s = 0.080

// Note, precision is given priority over lag. In general,
// if we can meet the precision requirement and we are
// below max lag, then we can try to tighten precision.

//var calibrator = Calibrator(
//    leastPrecision,
//    maxLag_s,
//    new EmaFilter());

/**
var calibrator = Calibrator(
    1.0,
    maxLag_s,
    new EuroFilter(1, 1));
/**/





