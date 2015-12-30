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
 * @param {boolean=} restarted
 */
var startWatcher = function ( oraPath, outDir, restarted ) {

    var watchEnded = false,
        id = nextId();

    var outFilename = path.basename( oraPath ).replace( '.ora', '.png' );

    console.log( id, 'Will save to ', outFilename, ' in ', outDir );
    var outFile = path.join( outDir, outFilename );

    /**
     * @param {number} retries Number of retries
     */
    var toImage = ( retries ) => {
        console.log( id, 'Converting to PNG ...' );
        try {
            oti.oraToImage( oraPath, outFile, function ( err ) {
                console.log( id, 'PNG generated: ', !err );
                if ( err ) {
                    if ( retries > 0 ) {
                        console.log( id, 'Failed generating ' + outFile + ', trying again ... (' + err + ')' );
                        setTimeout( () => toImage( retries - 1 ), 100 );
                    } else {
                        console.log( id, 'Failed generating ' + outFile );
                        console.warn( err );
                    }
                }
            } );
        } catch ( err ) {
            console.warn( err );
        }
    };

    var watcher = function ( event, filename ) {
        if ( watchEnded ) {
            console.log( id, 'Event received although watch ended: ', event, filename );
            return;
        }

        if ( event === 'change' ) {
            console.log( id, 'File changed:', filename );
            toImage( 1 );

        } else if ( event === 'rename' ) {
            console.log( id, 'File was renamed: ', filename );
            watchEnded = true;
            startWatcher( oraPath, outDir, true );

        } else {
            console.warn( id, 'Unknown event: ', event, filename );
        }

    };

    var startWatching = function ( restart ) {
        console.log( 'Starting watcher ', id );

        try {

            fs.watch( oraPath, watcher );
            if ( !restarted ) {
                toImage( 1 );
            }

        } catch ( e ) {
            if ( restart ) {
                setTimeout( () => startWatching( false ), 100 );
            } else {
                console.warn( 'Could not start watcher for ' + oraPath, e );
            }
        }
    };

    startWatching( true );
};

function observe( boardDir, outDir ) {

    console.log( 'Observing ', boardDir, ' and generating files to ', outDir );

    /** List of watched files. */
    var watched = [];

    scan();

    function scan() {

        fs.readdir( boardDir, function ( err, files ) {

            if ( err ) {
                console.warn( err );
            } else {

                // List files in directory, and watch new ones.
                files.forEach( ( f ) => {
                    if ( f.endsWith( '.ora' ) ) {

                        if ( watched.indexOf( f ) >= 0 ) {
                            // Already watching this file.
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

        // Scan again in a bit.
        setTimeout( scan, 4000 );
    }
}

var boardDir = path.join( __dirname, 'boards' ),
    outDir = __dirname;

observe( boardDir, outDir );

