

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



