module.exports = function(grunt) {

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: true
      },
      files: ['*.js']
    },

    // clean up generated stuff
    clean: {
      build: ['dist'],
      bower: ['lib']
    },

    // concatenate java script files
    concat: {
      options: {
        //sourceMap: true
      },
      viewer: {
        src: ['viewer.js'],
        dest: 'dist/viewer.js'
      }
    },

    // compress js code (instead of just concatenating)
    uglify: {
      options: {
        mangle: true,
        sourceMap: true,
        compress: {}
      },
      uglified_build: {
        files: {
          'dist/viewer.min.js': [
            'viewer.js'
           ]
        }
      },
    },

    // watch code while developing and
    // re-build if something changes
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['build']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('build', ['jshint', 'clean:build', 'uglify', 'concat']);
};
