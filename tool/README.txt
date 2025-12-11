HOW TO RUN THE LINE MAPPER:

1. Navigate to the src folder inside the "file-version-line-mapper" folder.

2. Once in that run the following command: "node map_lines.js [file_path_1] [file_path_2] [output_file_path]"
    -> Here, "file_path_1" & "file_path_2" are the actual file paths you want to test.

3. The output will be created/updated in the file listed as [output_file_path]

4. To run our groups Dataset, run the following bash command ./runGroupSet.sh
    Output will be contained within src/mappings.
    
NOTE: To test with some of the test files used in development, 
      you can try the following commands:

      a. "node map_lines.js ../sample_files/test1.txt ../sample_files/test2.txt ../mapping.json"

      b. "node map_lines.js ../sample_files/OrderService.java ../sample_files/OrderService2.java ../mapping.json"
