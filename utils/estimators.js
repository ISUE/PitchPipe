
/**
 * See online algorithm on Wikipedia:
 * https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
 */
function RunningStatistics()
{
    this.count = 0.0;
    this.mean = 0.0;
    this.M2 = 0.0;
    this.variance = 0.0;
    this.ci95 = 0.0; 
    this.max = -Infinity;

    /**
     * Iteratively calculate mean and variance.
     */
    this.update = function(newValue)
    {
        this.count += 1.0;
        this.delta = newValue - this.mean;
        this.mean = this.mean + this.delta / this.count;
        this.delta2 = newValue - this.mean;
        this.M2 += this.delta * this.delta2;
        this.max = Math.max(
            this.max,
            newValue);

        this.variance = this.M2/(this.count - 1.0);
        this.ci95 = 1.96 * Math.sqrt(this.variance / this.count);
    }
}

/**
 * Call every time input device is sampled to 
 * determine the average frame rate.
 */
function FrameRateEstimator()
{
    var stats = new RunningStatistics()
    var lastTime_ms = 0.0;

    this.update = function()
    {
        var now = Date.now();

        if(lastTime_ms > 0.0)
        {
        	delta = now - lastTime_ms;
            stats.update(delta);
        }

        lastTime_ms = now;
    }

    this.fps = function()
    {
        return 1000.0 / stats.mean;
    }
}

/**
 * Call after each input device measurement to track 
 * the maximum distance between samples. 
 */
function MaximumDistanceEstimator()
{
    var previous = null;
    //var stats = new RunningStatistics();

    // This is used to tack the top speeds. We will
    // take the minimum max speed, assuming the others
    // are outliers due to noise or system tracking errors
    var speeds = new Array(5);

    for(var ii = 0;
        ii < speeds.length;
        ii++)
    {
        speeds[ii] = 0.0;
    }

    this.update = function(
        sample,
        stddev)
    {
        if (previous === null)
        {
            previous = sample;
        }

        delta = Math.abs(previous - sample);

        if(delta > 3.0 * stddev)
        {
            var minimumIdx = 0;

            for(var ii = 1;
                ii < speeds.length;
                ii++)
            {
                if(speeds[ii] < speeds[minimumIdx])
                {
                    minimumIdx = ii;
                }
            }

            if(delta > speeds[minimumIdx])
            {
                speeds[minimumIdx] = delta;
            }
        }


        previous = sample;
    }

    /**
     * Return mean.
     */
    this.velocity = function()
    {
        var minimumIdx = 0;

        for(var ii = 1;
            ii < speeds.length;
            ii++)
        {
            if(speeds[ii] < speeds[minimumIdx])
            {
                minimumIdx = ii;
            }
        }

        return speeds[minimumIdx];
    }
}

/**
 * Estimates power spectral density on the monitor_hz frequency
 * in order to estimate Gaussian white noise variance in 
 * an input device signal. When using, ensure the user is 
 * idle. Slow movements are fine, but jerks and abrupt 
 * stops may inflate the estimate.
 * 
 * Note 1, sample_hz / 2 is the Nyquist frequency, the highest
 * frequency we can monitor. To simply things, let monitor_hz
 * represent a countdown offset from the Nyquist frequency in 
 * 0, 1, 2, etc.
 *
 * Note 2, for illustrative purposes, this object is written to 
 * monitor one frequency, but can easily be rewritten to 
 * efficiently monitor multiple frequencies.
 */
function NoiseEstimator(
    monitor_hz,
    sample_hz) 
{
    // Ensure sample rate is in on integer boundary and
    // is even. Don't worry though... everything still 
    // works even when the real sample rate doesn't match
    // the estimated rate.
    sample_hz = Math.round(sample_hz);
    var sample_hz = sample_hz + sample_hz % 2;
    var monitor_hz = (sample_hz / 2) - monitor_hz;

    // Setup place to store one second worth of samples.
    var samples = new CircularBuffer(sample_hz);
    samples.fill(Complex.ZERO)

    // X1 represents the frequency we want to monitor, but 
    // for a Hanning window, we need its neighbors as well.
    var X0 = Complex.ZERO;
    var X1 = Complex.ZERO;
    var X2 = Complex.ZERO;

    var W0 = Complex(0.0, -2.0*Math.PI*(monitor_hz - 1.0)/sample_hz).exp();
    var W1 = Complex(0.0, -2.0*Math.PI*(monitor_hz + 0.0)/sample_hz).exp();
    var W2 = Complex(0.0, -2.0*Math.PI*(monitor_hz + 1.0)/sample_hz).exp();

    // Count and power estimate accumulation.
    var power = 0.0;
    var N = 0.0;

    // Determine normalization factor W for Hanning window.
    var W = 0.0;
    
    for(ii = 0.0;
        ii < sample_hz;
        ii++)
    {
        var tmp = 2.0 * Math.PI * ii / (sample_hz - 1.0);
        var win = 0.5 - 0.5 * Math.cos(tmp);
        W += win * win;
    }

    /**
     * Add a new sample to the estimator.
     */
    this.update = function(sample)
    {
        sample = Complex(sample, 0.0);
        X0 = W0.mul(X0.add(sample).sub(samples.get(0)));
        X1 = W1.mul(X1.add(sample).sub(samples.get(0)));
        X2 = W2.mul(X2.add(sample).sub(samples.get(0)));
        samples.add(sample);

        N += 1.0;
        if (N >= sample_hz)
        {
            tmp = Complex.HALF.mul(X1)
                .sub(Complex.QUATER.mul(X0))
                .sub(Complex.QUATER.mul(X2));

            power += Math.pow(tmp.abs(), 2.0);
        }
    }

    /**
     * Return current noise variance estimate.
     */
    this.variance = function()
    {
        n = N - sample_hz;

        if (n <= 0)
        {
            return 0.0;
        }

        return power / (n * W);
    }
}




