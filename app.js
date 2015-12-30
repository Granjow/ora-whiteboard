var fs = require( 'fs' ),
    path = require( 'path' ),
    oti = require( 'ora-to-image' );

var nextId = (function () {
    var id = 0;
    return () => id++;
})();

/**
 * @param {string} oraPath
 * @param {string} outDir
 */
var startWatcher = function ( oraPath, outDir ) {

    var watchEnded = false,
        id = nextId();

    var outFilename = path.basename( oraPath ).replace( '.ora', '.png' );

    console.log( 'Will save to ', outFilename, ' in ', outDir );
    var outFile = path.join( outDir, outFilename );

    var toImage = () => {
        try {
            oti.oraToImage( oraPath, outFile, function ( err ) {
                console.log( 'PNG generated: ', !err );
            } );
        } catch ( err ) {
            console.warn( err );
        }
    };

    console.log( 'Starting watcher ', id );

    fs.watch( oraPath, function ( event, filename ) {
        if ( watchEnded ) {
            console.log( id, 'Event received although watch ended: ', event, filename );
            return;
        }

        if ( event === 'change' ) {
            console.log( id, 'File changed:', filename );
            toImage();

        } else if ( event === 'rename' ) {
            console.log( id, 'File was renamed: ', filename );
            watchEnded = true;
            startWatcher( oraPath, outDir );

        } else {
            console.warn( id, 'Unknown event: ', event, filename );
        }

    } );

    try {
        toImage();
    } catch ( err ) {
        console.warn( 'Could not convert: ', err );
    }
};

function observe( boardDir, outDir ) {

    console.log( 'Observing ', boardDir, ' and generating files to ', outDir );

    var watched = [];
    scan();

    function scan() {
        fs.readdir( boardDir, function ( err, files ) {
            if ( err ) {
                console.warn( err );
            } else {
                files.forEach( ( f ) => {
                    if ( f.endsWith( '.ora' ) ) {

                        if ( watched.indexOf( f ) >= 0 ) {
                            console.log( 'Already watching: ', f );
                        } else {
                            console.log( 'ORA found: ', f );
                            startWatcher( path.join( boardDir, f ), outDir );
                            watched.push( f );
                        }
                    } else {
                        console.log( 'Skipping ', f );
                    }
                } );
            }
        } );
        setTimeout( scan, 4000 );
    }
}

var boardDir = path.join( __dirname, 'boards' ),
    outDir = __dirname;

observe( boardDir, outDir );

