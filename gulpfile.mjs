'use strict';

import gulp from 'gulp';
import { deleteAsync as del } from 'del';
import install from 'gulp-reinstall';
import zip from 'gulp-zip';
import changed from 'gulp-changed';
import cp from 'child_process';
import tape from 'gulp-tape';
import plumber from 'gulp-plumber';
import tapColorize from 'tap-colorize';
import tapJson from 'tap-json';

// Support command-line arg that specifies which stack to deploy, for the deploy task
import yargs from 'yargs';

const argv = yargs.option(
    {
        's': {
            alias: 'stack',
            type: 'string',
            nargs: 1,
            default: 'default'
        },
        'w': {
            alias: 'whatif',
            type: 'boolean',
            default: 'false'
        },
        'nocolor': {
            type: 'boolean',
            nargs: 0,
            default: false
        }
    })
    .argv;

var paths = {
    zip: {
        src: 'dist/**/*',
        dest: 'zip/',
        name: 'dyndns_lambda.zip'
    },
    dist: 'dist/',
    js: {
        src: 'src/**/*.js',
        test: 'src/**/*.spec.js',
        dest: 'dist/',
        clean: [ 'dist/**/*.js', '!dist/node_modules/**/*' ]
    },
    npm: {
        src: ['package.json', 'package-lock.json'],
        package: 'package.json',
        dest: 'dist/',
        cache: 'tmp/npmcache/',
        clean: [ 'dist/package.json', 'dist/package-lock.json', '/dist/node_modules', 'tmp/npmcache' ]
    }
};

let task;
gulp.task('clean:src', () => {
    return del(paths.js.clean);
});

gulp.task('clean:npm', () => {
    return del([ paths.dist + 'node_modules', paths.npm.cache ]);
});

gulp.task('clean:zip', () => {
    return del([ paths.zip.dest ]);
});

gulp.task('clean', gulp.parallel('clean:src', 'clean:npm', 'clean:zip'));
task = gulp.task('clean');
task.description = 'Cleans the output folders.';

gulp.task('test:unit', () => {
    let reporter;

    if (argv.nocolor) {
        reporter = tapJson();
    } else {
        reporter = tapColorize();
    }

    reporter.pipe(process.stdout);

    return gulp.src(paths.js.test)
        .pipe(plumber({ errorHandler: () => {} }))
        .pipe(tape({ outputStream: reporter }));
});
task = gulp.task('test:unit');
task.description = 'Runs unit tests';

function copyJs() {
    return gulp.src([ paths.js.src, '!' + paths.js.test ])
        .pipe(gulp.dest(paths.js.dest));
}
copyJs.description = 'Copies the JS files into the destination folder.';

gulp.task('npm:copy-package-def', () => {
    // Only copies the package file if it has changed, to preserve last-modified timestamp
    return gulp.src(paths.npm.src)
        .pipe(changed(paths.npm.dest))
        .pipe(gulp.dest(paths.npm.dest));
});
task = gulp.task('npm:copy-package-def');
task.description = 'Copies the NPM package file into the destination folder.';

gulp.task('npm:install-packages', () => {
    // Copies dummy version of the package file into a cache folder
    // so that we can check whether it has changed and therefore whether
    // we need to re-run the install
    return gulp.src(paths.npm.dest + paths.npm.package)
        .pipe(changed(paths.npm.cache))
        .pipe(install({ production: true }))
        .pipe(gulp.dest(paths.npm.cache));
});
task = gulp.task('npm:install-packages');
task.description = 'Installs the NPM packages into the destination folder.';

gulp.task('npm', gulp.series('npm:copy-package-def', 'npm:install-packages'));
task = gulp.task('npm');
task.description = 'Installs the NPM files into the destination folder.';

gulp.task('create-zip', () => {
    return gulp.src(paths.zip.src)
        .pipe(zip(paths.zip.name))
        .pipe(gulp.dest(paths.zip.dest));
});
task = gulp.task('npm');
task.description = 'Installs the NPM files into the destination folder.';

gulp.task('build:src', gulp.series('clean:src', copyJs));

gulp.task('build', gulp.series(gulp.parallel('build:src', 'npm'), 'create-zip'));
task = gulp.task('build');
task.description = 'Builds the distribution files';

gulp.task('fullbuild', gulp.series('clean', 'build'));

function deploy(done) {
    let cmd = './tf.sh -y -c apply -s ' + argv.stack;
    if (!argv.whatif) {
        let p = cp.exec(cmd);
        p.stdout.pipe(process.stdout);
        p.stderr.pipe(process.stderr);
        return p;
    } else {
        // eslint-disable-next-line no-console
        console.log(`whatif: ${cmd}`);
        done();
    }
}
deploy.description = 'Deploys to an AWS stack by using Terraform';

function planDeploy(done) {
    let cmd = './tf.sh -y -c plan -s ' + argv.stack;
    if (!argv.whatif) {
        let p = cp.exec(cmd);
        p.stdout.pipe(process.stdout);
        p.stderr.pipe(process.stderr);
        return p;
    } else {
        // eslint-disable-next-line no-console
        console.log(`whatif: ${cmd}`);
        done();
    }
}
planDeploy.description = 'Runs Terraform plan';

gulp.task('test', gulp.series('test:unit'));
gulp.task('deploy', deploy);
gulp.task('deploy:plan', planDeploy);

/*
 * Define default task that can be called by just running `gulp` from cli
 */
gulp.task('default', gulp.series('build'));
