const
    fs = require( 'fs' ),
    path = require( 'path' ),
    archiver = require( 'archiver' );

const from = path.join( __dirname, 'public', 'cache' );

var archive = archiver.create( 'zip', {} ),
    output = fs.createWriteStream( path.join( __dirname, 'demo.zip' ) );

archive.on( 'finish', function () {
    console.log( 'finish; Done.' );
} );

output.on( 'close', function () {
    console.log( archive.pointer() + ' total bytes' );
} );

fs.readdirSync( from ).forEach( ( file ) => {
    if ( file.toLowerCase().endsWith( '.png' ) ) {
        console.log( 'Adding:', file );
        archive.file( path.join( from, file ), {
            name: file,
            prefix: 'boards'
        } );
    }
} );


archive.finalize();
archive.pipe( output );
