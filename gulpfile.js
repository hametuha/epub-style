const gulp = require( 'gulp' );
const fs = require( 'fs' );
const $ = require( 'gulp-load-plugins' )();
const sass = require('gulp-sass')( require( 'node-sass' ) );
const mozjpeg = require( 'imagemin-mozjpeg' );
const pngquant = require( 'imagemin-pngquant' );
const webpack = require( 'webpack-stream' );
const webpackBundle = require( 'webpack' );
const named = require( 'vinyl-named' );
const browserSync = require( 'browser-sync' );

const docDir  = process.env.doc || 'manuscripts';
const version = process.env.version || '1.0.0';

//
// SCSS tasks
// ================
//

// Lint SCSS
gulp.task( 'scss:lint', function() {
	return gulp.src( './assets/scss/**/*.scss' )
		.pipe( $.plumber( {
			errorHandler: $.notify.onError( 'Stylelint: <%= error.message %>' ),
		} ) )
		.pipe( $.stylelint( {
			reporters: [
				{
					formatter: 'string',
					console: true,
				},
			],
		} ) );
} );

// Generate CSS.
gulp.task( 'scss:generate', function() {
	return gulp.src( [
		'./assets/scss/**/*.scss',
	] )
		.pipe( $.plumber( {
			errorHandler: $.notify.onError( 'SCSS: <%= error.message %>' ),
		} ) )
		.pipe( $.sourcemaps.init( { loadMaps: true } ) )
		.pipe( sass( {
			errLogToConsole: true,
			outputStyle: 'compressed',
		} ) )
		.pipe( $.autoprefixer() )
		.pipe( $.sourcemaps.write( './map' ) )
		.pipe( gulp.dest( './dist/css' ) );
} );

gulp.task( 'scss', gulp.parallel( 'scss:generate', 'scss:lint' ) );

//
// JS Bundle
// ===============
//

// Minify All
gulp.task( 'js:bundle', function() {
	const tmp = {};
	return gulp.src( [ './src/js/app.js' ] )
		.pipe( $.plumber( {
			errorHandler: $.notify.onError( '<%= error.message %>' ),
		} ) )
		.pipe( named() )
		.pipe( $.rename( function( path ) {
			tmp[ path.basename ] = path.dirname;
		} ) )
		.pipe( webpack( require( './webpack.config.js' ), webpackBundle ) )
		.pipe( $.rename( function( path ) {
			if ( tmp[ path.basename ] ) {
				path.dirname = tmp[ path.basename ];
			} else if ( '.map' === path.extname && tmp[ path.basename.replace( /\.js$/, '' ) ] ) {
				path.dirname = tmp[ path.basename.replace( /\.js$/, '' ) ];
			}
			// Change extension.
			path.extname = '.min.js';
			return path;
		} ) )
		.pipe( gulp.dest( './assets/js/' ) );
} );

// ESLint
gulp.task( 'js:eslint', function() {
	return gulp.src( [ 'src/**/*.js' ] )
		.pipe( $.eslint( { useEslintrc: true } ) )
		.pipe( $.eslint.format() );
} );

// JS task.
gulp.task( 'js', gulp.parallel( 'js:bundle', 'js:eslint' ) );


//
// Image min
// ==============
//

// SVG Minify and copy
gulp.task( 'imagemin:svg', function() {
	return gulp.src( './assets/img/**/*.svg' )
		.pipe( $.svgmin() )
		.pipe( gulp.dest( './dist/img' ) );
} );

// Image min
gulp.task( 'imagemin:misc', function() {
	return gulp.src( [
		'./assets/img/**/*',
		'!./assets/img/**/*.svg',
	] )
		.pipe( $.imagemin( [
			pngquant( {
				quality: [ .65, .8 ],
				speed: 1,
				floyd: 0,
			} ),
			mozjpeg( {
				quality: 85,
				progressive: true,
			} ),
			$.imagemin.svgo(),
			$.imagemin.optipng(),
			$.imagemin.gifsicle(),
		] ) )
		.pipe( gulp.dest( './dist/img' ) );
} );

// minify all images.
gulp.task( 'imagemin', gulp.parallel( 'imagemin:misc', 'imagemin:svg' ) );

//
// HTML
// ==============
//

// Pug
gulp.task( 'pug', () => {
	const content = fs.readFileSync( './manuscripts/kokoro.html' )
	return gulp.src( [
		'assets/pug/**/*.pug',
		'!assets/pug/**/_*.pug',
	] )
		.pipe( $.plumber( {
			errorHandler: $.notify.onError( 'PUG: <%= error.message %>' ),
		} ) )
		.pipe( $.pug( {
			pretty: true,
			locals: {
				content,
				version,
			}
		} ) )
		.pipe( gulp.dest( 'dist' ) );
} );

// BrowserSync
gulp.task('browser-sync', ( done ) => {
	browserSync({
		server: {
			baseDir: "./dist/",
			index: "index.html"
		},
		reloadDelay: 500
	});
	done();
});

// BrowserSync watch
gulp.task( 'bs-watch', ( done ) => {
	gulp.watch([
		'dist/**/*',
	], gulp.task( 'bs-reload' ) );
	done();
});

// Reload
gulp.task( 'bs-reload', ( done ) => {
	browserSync.reload();
	done();
} ) ;

//
// Watch
// =================
//
gulp.task( 'watch', ( done ) => {
	// Make SASS
	gulp.watch( [
		'assets/scss/**/*.scss',
	], gulp.task( 'scss' ) );
	// JS
	gulp.watch( [ 'assets/js/**/*.js' ], gulp.task( 'js' ) );
	// Minify Image
	gulp.watch( 'assets/img/**/*', gulp.task( 'imagemin' ) );
	// Make HTML.
	gulp.watch( 'assets/pug/**/*.pug', gulp.task( 'pug' ) );

	done();
} );

//
// Global commands.
// ================
//

// Build
gulp.task( 'build', gulp.series( gulp.parallel( 'pug', 'js:bundle', 'scss:generate', 'imagemin' ) ) );

// Default Tasks
gulp.task( 'default', gulp.series( 'watch', 'browser-sync', 'bs-watch' ) );

// HTML
gulp.task( 'html', gulp.series( gulp.parallel( 'build', 'watch' ), gulp.series( 'browser-sync', 'bs-watch' ) ) );
