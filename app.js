var fs = require( 'fs' ),
    oti = require( 'ora-to-image' );

fs.watch( 'board.ora', function ( event, filename ) {
    if ( event === 'change' ) {
        console.log( 'File changed:', filename );
    } else {
        console.warn( 'Unknown event: ', event );
    }
} );