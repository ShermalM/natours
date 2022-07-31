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
            url: `/api/v1/users/${url}`,
            data
        });

        if(result.data.status === 'success'){
            showAlert('success',`${type.toUpperCase()} updated successfully!`);
        } 
    } catch(err){
        showAlert('error', err.response.data.message);
    }
};