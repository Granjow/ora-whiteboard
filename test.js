var oraWhiteboard = require( './app.js' );

oraWhiteboard.logLevel = 'info';

oraWhiteboard.startOraBoard( {
    boardDir: 'boards',
    port: 3311,
    title: 'Demo: Live ORA Whiteboard',
    sharedFs: true
} );