(function () {
    var app = angular.module( 'oraBoard', [] );

    app.controller( 'ThumbsController', [ '$http', '$interval', function ( $http, $interval ) {


        this.imageData = [ { name: 'a' }, { name: 'b' } ];

        var me = this;

        var reload = function () {
            $http.get( '/boards/list/' ).then( function ( response ) {
                console.log( 'Data received: ', response );
                me.imageData = response.data.boards;
            }, function ( err ) {
                console.warn( 'Failed: ', err );
            } );
        };

        $interval( reload, 1000 );

        reload();

    } ] );

})();
