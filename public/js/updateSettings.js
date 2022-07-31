import axios from 'axios';
import { showAlert } from './alert';

// type is either 'password' or 'data'
export const updateSettings = async (data, type) => {
    console.log('entered function');
    try{
        const url = type === 'password' ? 'updateMyPassword' : 'updateMe';

        console.log(data);

        const result = await axios({
            method: 'PATCH',
            url: `http://127.0.0.1:3000/api/v1/users/${url}`,
            data
        });

        if(result.data.status === 'success'){
            showAlert('success',`${type.toUpperCase()} updated successfully!`);
        } 
    } catch(err){
        showAlert('error', err.response.data.message);
    }
};