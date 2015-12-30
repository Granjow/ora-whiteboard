var fs = require( 'fs' ),
    path = require( 'path' ),
    oti = require( 'ora-to-image' );

var oraPath = path.join( __dirname, 'board.ora' );

fs.watch( oraPath, function ( event, filename ) {
    if ( event === 'change' ) {
        console.log( 'File changed:', filename );
        oti.oraToImage( oraPath, 'out.png' );
    } else {
        console.warn( 'Unknown event: ', event );
    }
} );