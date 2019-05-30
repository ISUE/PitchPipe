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
 * Standard circular buffer that stores cnt elements.
 */
function CircularBuffer(cnt)
{
    var data = new Array(cnt + 1);
    var cnt = cnt + 1;
    var head = 0;
    var tail = 0;

    /**
     * Returns how many elements are in buffer.
     */
    this.count = function()
    {
        var ret = tail - head;

        if (ret < 0)
            ret += cnt;

        return ret;
    }

    /**
     * Pushes a new item into buffer.
     * Oldest element is removed.
     */
    this.add = function(item)
    {
        // insert
        data[tail] = item;

        // and increment
        tail = (tail + 1) % cnt;

        if(tail === head)
        {
            head = (head + 1) % cnt;
        }
    }

    /**
     * Look up specific item in buffer where index 0
     * is the oldest and this.count()-1 is the newest.
     * Also, supports negative indexing... so we have
     * this.get(-1) is similarly the newest.
     */
    this.get = function(idx)
    {
        if(idx < 0)
        {
            idx = tail + idx;

            if(idx < 0)
            {
                idx += cnt;
            }
        }
        else
        {
            idx += head;
        }

        idx = idx % cnt;
        return data[idx];
    }

    /**
     * Fills the whole buffer with the value given.
     */
    this.fill = function(val)
    {
    	var ii;

    	for(ii = 0;
    		ii < cnt;
    		ii ++)
    	{
    		this.add(val);
    	}
    }
}



