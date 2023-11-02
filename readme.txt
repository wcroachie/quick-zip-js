This is a tiny, quick-and-dirty, sync implementation of jimmy warting's zipStream for zipping multiple files in the browser.
Its purpose is to simply combine and download multiple javascript File objects, i.e. a group of images or text, to the client, all in 1 file for convenience. The zipped output will not be compressed.
It is based on this - https://github.com/jimmywarting/StreamSaver.js/blob/master/examples/zip-stream.js
While writing and debugging this I gained some insight into how zip files work.
