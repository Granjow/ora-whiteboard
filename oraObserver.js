const
    fs = require( 'fs' ),
    path = require( 'path' ),
    util = require( 'util' ),
    EventEmitter = require( 'events' ),
    oti = require( 'ora-to-image' );

var nextId = (function () {
    var id = 0;
    return () => id++;
})();

/**
 * @param {{oraPath:string, pngPath: string, sharedFs: boolean}} options
 *  sharedFs Set to true when working with a shared file system
 * @param {EventEmitter=} emitter
 * which does not provide modification events.
 */
var startWatcher = function ( options, emitter ) {

    var watchEnded = false,
        oraPath = options.oraPath,
        pngPath = options.pngPath,
        sharedFs = !!options.sharedFs,
        eventEmitter = emitter || new EventEmitter(),
        id = nextId();

    console.log( 'Shared FS mode: ' + (sharedFs ? 'on' : 'off') );

    /**
     * @param {number} retries Number of retries
     */
    var toImage = ( retries ) => {
        console.log( id, 'Converting to PNG ...' );
        try {
            oti.oraToImage( oraPath, pngPath, function ( err ) {
                if ( err ) {
                    if ( retries > 0 ) {
                        console.log( id, 'Failed generating ' + pngPath + ', trying again ... (' + err + ')' );
                        setTimeout( () => toImage( retries - 1 ), 100 );
                    } else {
                        console.log( id, 'Failed generating ' + pngPath );
                        console.warn( err );
                    }
                } else {
                    console.log( id, 'PNG generated: ', pngPath );
                    console.log( 'Emitter: ', eventEmitter );
                    eventEmitter.emit( 'update', pngPath );
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
            startWatcher( options, eventEmitter );

        } else {
            console.warn( id, 'Unknown event: ', event, filename );
        }

    };

    var fileWatcher = ( curr, prev ) => {
        if ( prev.mtime !== curr.mtime ) {
            //console.log( 'Modification time changed from ' + prev.mtime + ' to ' + curr.mtime );
            toImage( 1 );
        } else {
            console.log( 'File was not modified: ', curr, prev );
        }
    };

    var startWatching = function ( restart ) {
        console.log( 'Starting watcher ', id );
        var restarted = !!emitter;

        try {

            // Use watchFile for shared file systems,
            // and watch for those supporting events
            if ( sharedFs ) {
                fs.watchFile( oraPath, fileWatcher );
            } else {
                fs.watch( oraPath, watcher );
            }

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

    return eventEmitter;
};

var ObserverEmitter = function () {
    EventEmitter.call( this );

    this._watched = [];

    return this;
};
ObserverEmitter.prototype = {
    watchedFiles: function () {
        return this._watched.map( ( desc ) => path.basename( desc.png ) );
    },
    watchedFilesDetails: function () {
        return this._watched.map( ( desc ) => ({
            name: path.basename( desc.png ),
            rev: desc.rev
        }) );
    },
    addWatched: function ( ora, png ) {
        this._watched.push( { ora: ora, png: png, rev: 0 } );
    },
    isWatched: function ( ora ) {
        return this._watched.some( ( desc ) => desc.ora === ora );
    },
    hasImage: function ( png ) {
        return this._watched.some( ( desc ) => path.basename( desc.png ) === png );
    },
    fullImagePath: function ( png ) {
        return this._watched
            .filter( ( desc ) => path.basename( desc.png ) === png )
            .map( ( desc ) => desc.png )
            [ 0 ];
    },
    update: function ( png ) {
        console.log( 'Revision update for ', png );
        this._watched.filter( ( desc ) => desc.png === png ).forEach( ( desc ) => {
            desc.rev++;
            console.log( png, 'r' + desc.rev );
            this.emit( 'update', png );
        } );
    }
};
util.inherits( ObserverEmitter, EventEmitter );

/**
 *
 * @param {string} boardDir
 * @param {string} outDir
 * @param {{sharedFs:boolean}} options
 * @returns {ObserverEmitter}
 */
function observe( boardDir, outDir, options ) {

    console.log( 'Observing ', boardDir, ' and generating files to ', outDir );

    /** List of watched files. */
    var observerEmitter = new ObserverEmitter(),
        skipList = [];

    scan();

    function scan() {

        fs.readdir( boardDir, function ( err, files ) {

            if ( err ) {
                console.warn( err );
            } else {

                // List files in directory, and watch new ones.
                files.forEach( ( f ) => {

                    var watcher,
                        oraPath,
                        pngPath;

                    // Only use .ora files, and ignore files which start with a .
                    if ( f.toLowerCase().endsWith( '.ora' ) && f[ 0 ] !== '.' ) {

                        oraPath = path.join( boardDir, f );
                        pngPath = path.join( outDir, f.substring( 0, f.length - 4 ) + '.png' );

                        // Watch this file, if it is not being watched already.
                        if ( !observerEmitter.isWatched( oraPath ) ) {

                            console.log( 'ORA found: ', f );
                            observerEmitter.addWatched( oraPath, pngPath );
                            watcher = startWatcher( {
                                oraPath: oraPath,
                                pngPath: pngPath,
                                sharedFs: options.sharedFs
                            } );

                            watcher.on( 'update', ( path ) => {
                                observerEmitter.update( path );
                            } );
                        }

                    } else if ( skipList.indexOf( f ) < 0 ) {
                        console.log( 'Skipping ', f );
                        skipList.push( f );
                    }

                } );

            }
        } );

        // Scan again in a bit.
        setTimeout( scan, 4000 );
    }

    return observerEmitter;
}

module.exports = {
    observe
};