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
 * @param {string} oraPath
 * @param {string} pngPath
 * @param {EventEmitter=} emitter
 */
var startWatcher = function ( oraPath, pngPath, emitter ) {

    var watchEnded = false,
        eventEmitter = emitter || new EventEmitter(),
        id = nextId();

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
            startWatcher( oraPath, pngPath, eventEmitter );

        } else {
            console.warn( id, 'Unknown event: ', event, filename );
        }

    };

    var startWatching = function ( restart ) {
        console.log( 'Starting watcher ', id );
        var restarted = !!emitter;

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
 * @returns {ObserverEmitter}
 */
function observe( boardDir, outDir ) {

    console.log( 'Observing ', boardDir, ' and generating files to ', outDir );

    /** List of watched files. */
    var observerEmitter = new ObserverEmitter();

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

                    if ( f.toLowerCase().endsWith( '.ora' ) ) {

                        oraPath = path.join( boardDir, f );
                        pngPath = path.join( outDir, f.substring( 0, f.length - 4 ) + '.png' );

                        // Watch this file, if it is not watched already.
                        if ( !observerEmitter.isWatched( oraPath ) ) {

                            console.log( 'ORA found: ', f );
                            observerEmitter.addWatched( oraPath, pngPath );
                            watcher = startWatcher( oraPath, pngPath );

                            watcher.on( 'update', ( path ) => {
                                observerEmitter.update( path );
                            } );
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

    return observerEmitter;
}

module.exports = {
    observe
};