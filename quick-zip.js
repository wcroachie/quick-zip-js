/**
 * A synchronous, minimal zip method based on jimmy warting's zip stream
 * based on this - https://github.com/jimmywarting/StreamSaver.js/blob/master/examples/zip-stream.js
 */

/**
 * @param {Array[File]} files - mandatory - an array of File objects
 * @param {String} zipFilename (optional) - the name of the zip file. will automatically generate a random string if none is provided.
 * @returns {File} a zip file
 */
function zip( files, zipFilename=Math.random().toString(36).slice(2)+".zip" ){

  class Crc32{
    constructor(){
      this.crc = -1;
    }
    append( data ){
      let
        crc = this.crc | 0,
        table = this.table
      ;
      for( let offset=0, len=data.length|0; offset<len; offset++ ){
        crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF];
      }
      this.crc = crc;
    }
    get(){
      return ~this.crc;
    }
    table = (()=>{
      let i, j, t, table = [];
      for( i=0; i<256; i++ ){
        t = i;
        for( j=0; j<8; j++ ){
          t = (t & 1) ? (t >>> 1) ^ 0xEDB88320 : t >>> 1;
        }
        table[i] = t;
      }
      return table;
    })();
  }

  function getDataHelper( byteLength ){
    var uint8 = new Uint8Array(byteLength);
    return {
      array: uint8,
      view: new DataView(uint8.buffer)
    };
  }

  const encoder = new TextEncoder();
  let offset = 0;
  let entries = [];
  let ui8s = [];

  for( const file of files ){

    if( file instanceof File === false ){
      throw "input was not a file"
    }

    let name = file.name.trim();
    const date = new Date( typeof file.lastModified === "undefined" ? Date.now() : file.lastModified );
    const nameBuf = encoder.encode( name );

    let entry = {
      nameBuf,
      compressedLength : 0,
      uncompressedLength : 0,
      crc : new Crc32()
    };

    /* file entry header */
    !function(){
      var header = getDataHelper(26);
      var data = getDataHelper(30 + nameBuf.length);
      entry.offset = offset;
      entry.header = header;
      header.view.setUint32(0, 0x14000808);
      header.view.setUint16(6, (((date.getHours() << 6) | date.getMinutes()) << 5) | date.getSeconds() / 2, true);
      header.view.setUint16(8, ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) | date.getDate(), true);
      header.view.setUint16(22, nameBuf.length, true);
      data.view.setUint32(0, 0x504b0304);
      data.array.set(header.array, 4);
      data.array.set(nameBuf, 30);
      offset += data.array.length;
      ui8s.push(data.array);
    }();

    /* file entry body */
    !function(){
      let req = new XMLHttpRequest();
      req.open( "GET", URL.createObjectURL( file ), false );
      req.overrideMimeType( "text/plain; charset=x-user-defined" );
      req.send();
      URL.revokeObjectURL( req.responseURL );
      const outputData = new Uint8Array(req.response.split("").map( e => e.codePointAt() ));
      entry.crc.append(outputData);
      entry.uncompressedLength += outputData.length;
      entry.compressedLength += outputData.length;
      ui8s.push(outputData);
    }();
    
    /* file entry footer */
    !function(){
      var footer = getDataHelper(16);
      footer.view.setUint32(0, 0x504b0708);
      if (entry.crc) {
        entry.header.view.setUint32(10, entry.crc.get(), true);
        entry.header.view.setUint32(14, entry.compressedLength, true);
        entry.header.view.setUint32(18, entry.uncompressedLength, true);
        footer.view.setUint32(4, entry.crc.get(), true);
        footer.view.setUint32(8, entry.compressedLength, true);
        footer.view.setUint32(12, entry.uncompressedLength, true);
      }
      offset += entry.compressedLength + 16;
      ui8s.push(footer.array);
    }();

    entries.push(entry);

  }

  /* write the zip footer */
  !function(){

    let
      length = 0,
      index = 0
    ;

    for( const entry of entries ){
      length += 46 + entry.nameBuf.length + 0;
    }

    const data = getDataHelper(length + 22);

    for( const entry of entries ){
      data.view.setUint32(index, 0x504b0102);
      data.view.setUint16(index + 4, 0x1400);
      data.array.set(entry.header.array, index + 6);
      data.view.setUint16(index + 32, 0, true);
      data.view.setUint32(index + 42, entry.offset, true);
      data.array.set(entry.nameBuf, index + 46);
      data.array.set("", index + 46 + entry.nameBuf.length);
      index += 46 + entry.nameBuf.length + 0;
    }

    data.view.setUint32(index, 0x504b0506);
    data.view.setUint16(index + 8, entries.length, true);
    data.view.setUint16(index + 10, entries.length, true);
    data.view.setUint32(index + 12, length, true);
    data.view.setUint32(index + 16, offset, true);
    
    ui8s.push(data.array);

  }();

  /* normalize the file name */
  if( /\./.test(zipFilename) ){
    let ext = zipFilename.split(/\./).pop();
    zipFilename = zipFilename.slice(0,-ext.length) + "zip";
  }else{
    zipFilename = zipFilename + ".zip";
  }

  return new File(ui8s,zipFilename,{type:"application/zip"});

}
